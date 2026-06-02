# Permissions & RBAC

The two-tier role-based access control system that gates every server method, publication, and client view. Roles are MongoDB documents; users reference one role by `profile.roleId`; admins (`roles: true`) bypass all checks.

## Key files

- `server/main.ts` — `checkPermission`, `getUserRole` (+ 1-minute role cache), `normalizeRolePermissions`, `checkSpecialPermission`, `isOfficerOrAdmin`, `getSquadScope`, `validateUserId`, the dev/bootstrap admin seeders.
- `imports/api/types/role.ts` — the `Role` interface: boolean modules, `boolean | CrudPermission` modules, and the four `can*` special flags.
- `imports/api/collections/roles.collection.ts` — the `roles` Mongo collection (just `new Mongo.Collection<Role>('roles')`).
- `server/collection-registry.ts` — `COLLECTION_REGISTRY`: per-collection `module`, `fallback`, `allowsAnonymous`, `redact` (also documents FK/audit metadata).
- `server/mutation-pipeline.ts` — `runMutation`: the single auth → permission → fallback → override → validate → body → audit gate; emits `.denied` audit entries.
- `server/crud.lib.ts` — wires registry fields into `runMutation` for every generated CRUD method; gates publications (`createCollectionPublish`).
- `server/config.ts` — `CACHE.roleTtlMs`, `SQUAD_SCOPED_PERMISSIONS.enabled` (settings-overridable).
- `imports/ui/main/Main.tsx` — client-side `checkAccess` + `MODULE_PERMISSION_MAP` (view gating; cosmetic only).
- `imports/ui/members/roles/RolesForm.tsx` — the drawer form that edits a role's permission matrix.

## How it works

### Two permission tiers

A role is a flat document. Each module key is one of two shapes (`imports/api/types/role.ts`):

| Tier | Shape | Modules | Check signature |
|------|-------|---------|-----------------|
| Boolean module | `boolean` | `dashboard`, `orbat`, `logs`, `settings` | `checkPermission(userId, module)` — no operation |
| CRUD module | `boolean \| CrudPermission` | `members`, `events`, `tasks`, `squads`, `ranks`, `specializations`, `medals`, `eventTypes`, `briefingTemplates`, `taskStatus`, `registrations`, `discoveryTypes`, `positions`, `questionnaires` | `checkPermission(userId, module, operation)` |

`CrudPermission` is `{ read?, create?, update?, delete? }`. `roles` itself is `boolean | CrudPermission` — and when `roles === true` the user is a full **admin** (short-circuits every check). `BOOLEAN_MODULES` is the literal list in `server/main.ts:36`; `CRUD_MODULE_SET` is *derived* from the registry (`server/main.ts:42-44`) — every distinct `entry.module` minus the boolean ones — so adding a collection updates it automatically.

### `getUserRole` → `normalizeRolePermissions` → cache

`getUserRole(userId)` (`server/main.ts:91`):
1. Loads the user (`MembersCollection.findOneAsync`), reads `user.profile.roleId`. No role id → `null`.
2. Cache lookup keyed by **roleId** (not userId) with a `CACHE.roleTtlMs` (60 s default) TTL — so all members sharing a role share one cache entry.
3. On miss, loads the role doc and runs `normalizeRolePermissions`, then caches it (LRU eviction at `CACHE_MAX_SIZE = 1000`; a `Meteor.setInterval` sweeps expired entries every 5 min).

`normalizeRolePermissions` (`server/main.ts:69`) expands each CRUD module to the full four-op object so downstream checks never branch on shape:

| Stored value | Normalized to |
|--------------|---------------|
| `true` | `{ read: true, create: true, update: true, delete: true }` |
| `false` / `undefined` | `{ read: false, create: false, update: false, delete: false }` |
| `CrudPermission` object | left as-is |

Admin (`roles === true`) is preserved through normalization.

### `checkPermission`

`checkPermission(userId, module, operation?)` (`server/main.ts:125`) returns a `boolean`:

1. No role → `false`.
2. `role.roles === true` → `true` (admin bypass).
3. `module` is a boolean module → `permission === true`.
4. CRUD module + `operation` given → `permission[operation] === true`.
5. Bare `permission === true` (e.g. a special flag or legacy boolean CRUD module) → `true`; else `false`.

`checkSpecialPermission(userId, flag)` (`server/main.ts:161`) is the thin variant: it returns `role[flag] === true` for the four special flags (admins are admitted earlier by the `roles === true` branch in the calling pipeline, so this is only reached for non-admins).

### The mutation pipeline gate

Every generated CRUD method routes through `runMutation` (`server/mutation-pipeline.ts:146`). The pre-body gate order:

| Step | Behavior | On failure |
|------|----------|-----------|
| Auth | anonymous + `requireAuth` (default true) + not `allowAnonymous` | `.denied` log, `Meteor.Error(401)` |
| Permission | `checkPermission(userId, permissionModule, operation)` | falls through to fallback |
| Fallback flag | if denied and `fallbackFlag` set: `checkSpecialPermission(userId, flag)` | falls through to override |
| Permission override | if still denied and `permissionOverride` set: `await permissionOverride(ctx, args)` | `.denied` log, `Meteor.Error(403)` |
| Validate | `descriptor.validate(args)` | `.denied` log, re-throws the validation error |
| Body | runs the actual mutation | error propagates **untouched** (no `.denied`) |

`bodyStarted` flips true only after every gate passes, so telemetry can classify a pre-body rejection as `denied` vs. a body throw as `error`. The four special flags are wired in two ways:

- **`fallbackFlag`** (unconditional) — comes from `registryEntry.fallback`. `events.create` re-admits on `canCreateEvents`; `tasks.{create,update}` re-admit on `canManageTasks`. Set in `crud.lib.ts` (`fallbackFlag: fallback?.create` / `fallback?.update`).
- **`permissionOverride`** (conditional callback) — used by `members.update` so a caller lacking update permission may still edit `profile.specializationIds` *alone* if they hold `canManageSpecializations` (`server/apis/members.server.ts:180`). Kept as a callback per the Rule of Three (one site today).

### Denial auditing

A pre-body rejection calls `emitDenial` (`server/mutation-pipeline.ts:134`), writing a log via `createLog`. The action is `<collection>.<segment>.denied`, where the segment maps the operation:

| `operation` | denial segment |
|-------------|----------------|
| `create` | `insert` |
| `update` | `update` |
| `delete` | `remove` |
| `read` | `read` |

e.g. a blocked task create logs `tasks.insert.denied`. The payload always carries `{ userId }`; for `update`/`delete` it also includes `id` (when the first arg is a string), so denial entries are queryable by the same `(action, payloadId)` lookup as success entries. The `logs` collection itself never writes audit entries (`auditAllowed = collection !== 'logs'`).

### Publication gating

`createCollectionPublish` (`server/crud.lib.ts:133`) authorizes subscriptions, not just methods. Unless `allowsAnonymous.read` is set, an unauthenticated subscriber gets `this.ready()` (empty), and an authenticated one must pass `checkPermission(this.userId, module, 'read')` or the publication calls `this.ready()` and throws `403`. This closed SEC-003 (any authenticated user used to subscribe to any collection). The `events` publication is custom (`events.server.ts`) and additionally filters private events for non-officers.

### Special flags (`can*`)

| Flag | Wired via | Effect |
|------|-----------|--------|
| `canCreateEvents` | registry `fallback.create` on `events` | create events without `events.create` (Zeus role) |
| `canManageTasks` | registry `fallback.{create,update}` on `tasks` | create/update tasks without `tasks` perms (Developer role) |
| `canManageSpecializations` | `members.update` `permissionOverride` | edit only `profile.specializationIds` without `members.update` |
| `canManageRecruits` | UI/registration paths | recruit-management carve-out |

All four are edited in `RolesForm.tsx` under "Special Permissions" alongside the boolean and CRUD matrices.

## Squad-scoped permissions

An optional feature flag (`SQUAD_SCOPED_PERMISSIONS.enabled`, default `true`, settings-overridable) that restricts non-admin members to *their own squad's* data on member-facing reads. It does **not** change `checkPermission` — it narrows the Mongo selector.

- `isOfficerOrAdmin(role)` (`server/main.ts:169`) — currently `role.roles === true` (admin). The name anticipates an officer tier; today only admins are exempt from scoping.
- `getSquadScope(userId)` (`server/main.ts:174`) returns a partial selector:
  - flag disabled → `{}` (no scoping)
  - admin (`isOfficerOrAdmin`) → `{}`
  - no userId / no `profile.squadId` → `{}`
  - otherwise → `{ 'profile.squadId': squadId }`

The returned fragment is **spread-merged** into the query: `{ ...filter, ...squadScope }`. Two enforcement patterns exist:

| Pattern | Where | Mechanism |
|---------|-------|-----------|
| Filter merge on read | `members.read`/`members.findOne`/`members` publish (`members.server.ts:67,88,116`), `palette` member search (`palette.server.ts:60`), integrity traversal (`integrity/traversal.ts:45`) | merge `getSquadScope` into the selector so out-of-squad docs are never returned |
| Explicit reject on write | `members.update` body (`members.server.ts:200-204`) | a non-officer editing a member whose `profile.squadId` differs from the caller's throws `403` |

## Client-side view gating (`Main.tsx`)

`checkAccess(role, module)` (`imports/ui/main/Main.tsx:18`) mirrors `checkPermission` for *navigation/rendering only* — it decides whether a view renders or shows a `403` Result. It reads the single subscribed role doc reactively. **Cosmetic only**: the server pipeline is the real gate. Two view keys do not match a `Role` field name, so a remap table translates them:

| Navigation key | `Role` permission key | Reason |
|----------------|----------------------|--------|
| `backup` | `settings` | backup is a sub-feature of settings |
| `myQuestionnaires` | `questionnaires` | personal questionnaire view rides the questionnaires module |

`MODULE_PERMISSION_MAP` (`Main.tsx:13`) holds these; any unmapped key is used verbatim. For a CRUD-shaped permission, the view requires `.read === true`.

## Admin bootstrap

| Seeder | When | Source |
|--------|------|--------|
| `createTestData` (`main.ts:190`) | `NODE_ENV !== 'production'` startup | hard-codes `admin`/`admin` + an `admin` role (`roles: true`) |
| `bootstrapAdminFromSettings` (`main.ts:204`) | startup, only when the users collection is empty | credentials from `Meteor.settings.bootstrapAdmin` — production-safe first login for fresh stacks |

Both upsert the `admin` role with `roles: true`. `bootstrapAdminFromSettings` is a strict no-op once any user exists.

## Gotchas

- **Different collection name vs. permission module.** Several collections ride a parent module's permissions via `registryEntry.module` (`attendances`/`events` → `events`, `profilePictures` → `members`, `questionnaireResponses` → `questionnaires`). On the client `Section`, pass `permissionModule` when the collection name differs from the module (CLAUDE.md gotcha).
- **Cache is keyed by roleId, invalidated on role mutation only.** `clearRoleCache(roleId)` runs inside the `roles.update`/`roles.remove`/`bulkRemove` bodies (`crud.lib.ts`). Changing a member's *roleId* takes effect on the next `getUserRole` cache miss (≤ 60 s), but editing the *role document* clears immediately. There is no per-user invalidation.
- **`undefined` and `false` are equivalent** for a module: `normalizeRolePermissions` collapses both to all-false. A missing module key denies, it does not inherit.
- **Client `checkAccess` is not a security boundary.** It only hides views. Never rely on it to protect data — the `runMutation`/publication gates are authoritative.
- **Anonymous carve-outs are opt-in and narrow.** Only `registrations.insert` (`allowsAnonymous.insert`) and `discoveryTypes.read` (`allowsAnonymous.read`) accept a `null` userId. Everything else `.denied`/`401`s.
- **Admin special-flag confusion.** Admins pass via `roles === true`, not via the `can*` flags. The admin bypass in `checkPermission`/`runMutation` admits them before any `checkSpecialPermission` runs.
- **`isOfficerOrAdmin` is admin-only today** despite the name; squad scoping exempts only admins until an officer tier lands.

## See also

- `CONTEXT.md` → **CollectionPermissionRegistry** (registry fields), **MutationWithAudit** (the `runMutation` lifecycle), **Rule of three** (why `permissionOverride` stays a callback).
- `docs/collections.md` — field-level schema for the `roles` collection and every gated collection.
- `docs/views-and-forms.md` — `RolesForm` and the navigable views gated by `checkAccess`.
- `docs/deployment.md` — `Meteor.settings.bootstrapAdmin` and `squadScopedPermissions` overrides.
- `CLAUDE.md` → "Permission System", "Server-Mutation Lifecycle", "Common Gotchas → Permissions".
