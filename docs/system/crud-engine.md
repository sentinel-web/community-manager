# Generic CRUD Engine & Mutation Pipeline

One generic factory generates the full CRUD surface (methods + publications) for ~20 collections, and every server mutation — generic or custom — flows through a single shared auth→permission→validate→body→audit pipeline.

## Key files

- `server/crud.lib.ts` — the CRUD factory: `createCollectionMethods` / `createCollectionPublish` and the `getCollection()` lookup over the typed `COLLECTIONS` map.
- `server/mutation-pipeline.ts` — `runMutation(ctx, descriptor, args, body)`, the single mutation lifecycle; descriptor shape, standard audit-payload builders, denial emission.
- `server/collection-registry.ts` — `COLLECTION_REGISTRY`, the `Record<CrudCollectionName, CollectionRegistryEntry>` of per-collection metadata (module, fallback, allowsAnonymous, redact, foreignKeys, displayField, aiContext).
- `server/main.ts` (registration loop, `server/main.ts:376`) — calls the two factories for every name in `collectionNames`, plus method-only registration for `events`.
- `server/integrity/` + `server/apis/integrity.server.ts` — FK validation and on-delete effects invoked by the CRUD bodies; custom methods (`integrity.preview*`) that opt into `runMutation`. See [referential-integrity.md](./referential-integrity.md).

## How it works

### Registration (boot)

`server/main.ts` iterates two name lists and calls the factories (`server/main.ts:376`):

| List | Members | Registered |
|------|---------|------------|
| `collectionNames` | all CRUD collections except `events` | `createCollectionPublish` + `createCollectionMethods` |
| `methodOnlyCollections` | `events` | `createCollectionMethods` only (no generic publication) |

`getCollection(name)` resolves the live `Mongo.Collection` from the `COLLECTIONS` map (`server/crud.lib.ts:54`). The map is typed `{ readonly [K in CrudCollectionName]: Mongo.Collection<CrudCollectionMap[K]> }`, so each value's element type follows its key with zero casts, and **omitting a collection from the map is a compile error** (the mapped type demands a key for every union member). At runtime `getCollection` throws `Meteor.Error(404)` for an unknown name.

### Generated methods

`createCollectionMethods(collection)` registers seven methods under `Meteor.methods` (`server/crud.lib.ts:179`). Each body is a thin call to `runMutation` — the factory supplies a descriptor (gates + audit config) and a `body` closure (the data step):

| Method | `operation` | Audit on success | Body |
|--------|-------------|------------------|------|
| `<c>.read` | `read` | — | `Collection.find(filter, options).fetchAsync()` |
| `<c>.insert` | `create` | `<c>.created` (`auditShape: 'insert'`) | tasks get `createdAt`; `sanitizeHtmlFields`; `validateForeignKeys`; `insertAsync` |
| `<c>.update` | `update` | `<c>.updated` (`auditShape: 'update'`, with `before`) | `sanitizeHtmlFields`; full-doc `validateForeignKeysForUpdate`; `updateAsync({_id},{$set})`; `clearRoleCache` for roles |
| `<c>.remove` | `delete` | `<c>.deleted` (custom `audit` → `buildRemoveAuditPayload`) | existence check; `enforceIntegrityOnDelete`; `removeAsync`; `clearRoleCache` for roles |
| `<c>.bulkRemove` | `delete` | per-id `<c>.deleted` logged **inside** the body | loop ≤100 ids; per-id integrity + remove; returns `{ removed, errors }` |
| `<c>.count` | `read` | — | `Collection.countDocuments(filter)` |
| `<c>.options` | `read` | — | maps docs to `{ key, label, title, value, raw }` for selects |

Notes verified against source:
- The delete method is named `<c>.remove` (not `.delete`), though the permission op is `delete`.
- `bulkRemove` does **not** pass `action`/`auditShape` to its descriptor; it logs each successful delete itself via `createLog(\`${collection}.deleted\`, …)` so partial failures still produce per-id audit entries, and it continues past individual errors.
- `<c>.options` derives the label as `profile?.name || item.name`, which is why members (name under `profile.name`) and named reference collections both populate selects from one method.
- Audit is suppressed for the `logs` collection: `auditAllowed = collection !== 'logs'` leaves `action` undefined so CRUD on logs doesn't recursively log itself.

### Generated publications

`createCollectionPublish(collection)` registers a reactive `Meteor.publish(collection, …)` (`server/crud.lib.ts:133`). It is an **async** handler (Meteor 3 supports this) so it can `await checkPermission`:

1. If anonymous and the collection is not `allowsAnonymous.read`, return `this.ready()` (publish nothing).
2. `validateObject` the `filter` and `options`; `assertSafeSelector(filter)` to block operator-injection selectors.
3. Unless anonymous-readable, `checkPermission(userId, module, 'read')`; on denial call `this.ready()` then throw `Meteor.Error(403)`. (Fixes SEC-003 — previously any authenticated user could subscribe regardless of read permission.)
4. Clamp `options.limit` to `DEFAULT_PUBLISH_LIMIT = 100`, capped at `MAX_PUBLISH_LIMIT = 1000`, then return the cursor.

### The mutation lifecycle (`runMutation`)

Every generated method and every opted-in custom method routes through `runMutation(ctx, descriptor, args, body)` (`server/mutation-pipeline.ts:146`) — exactly one implementation of the lifecycle. See CONTEXT.md → **MutationWithAudit**. Stages, in order:

| # | Stage | Behavior | On failure |
|---|-------|----------|------------|
| 1 | **Auth** | reject anonymous (`!ctx.userId`) when `requireAuth` (default `true`) and not `allowAnonymous` | emit denial, throw `Meteor.Error(401)` |
| 2 | **Permission** | `checkPermission(userId, permissionModule, operation)`; on deny, try unconditional `fallbackFlag` via `checkSpecialPermission`, then a `permissionOverride(ctx, args)` callback | emit denial, throw `Meteor.Error(403)` |
| 3 | **Validate** | `descriptor.validate(args)` (per-method shape checks) | emit denial, **re-throw the original error** |
| 4 | **captureBefore** | optional snapshot read *after* gates, *before* body, for the update diff | returns `undefined` to omit |
| 5 | **Body** | `await body(args)` — the unique data step | error propagates untouched |
| 6 | **Audit** | success only: `descriptor.audit(args, result)` if present, else `buildStandardPayload(auditShape, …)` | — |

The whole call is wrapped in `instrument(method, …)` for telemetry; the closure flips `bodyStarted` once all pre-body gates pass, so a thrown error is classified `'denied'` (pre-body) vs `'error'` (body). Telemetry re-throws untouched.

**Error propagation.** Body errors are *not* normalized, wrapped, or translated. A body throwing `Meteor.Error('SomeCode', '…')` reaches the caller with `error.error === 'SomeCode'` intact. Only pre-body failures get a `<collection>.<op>.denied` audit entry (via `emitDenial`) capturing `userId`, plus the target `id` for `update`/`delete` (`OP_TO_DENIAL_SEGMENT` maps `create→insert`, `delete→remove`).

### Descriptor shape

`MutationDescriptor<TArgs, TResult>` (`server/mutation-pipeline.ts:13`):

| Field | Purpose |
|-------|---------|
| `collection` / `operation` | identity + permission op (`read`/`create`/`update`/`delete`) |
| `action` | audit-log action string, e.g. `events.created`; omit to skip success audit |
| `auditShape` | `'insert'` / `'update'` / `'remove'` — selects the standard payload builder |
| `audit` | custom `(args, result) => payload`, **overrides** `auditShape`; owns its own redaction |
| `redact` | keys stripped from the *standard* payload (top-level for insert; inside `changes`/`before` for update) |
| `captureBefore` | pre-mutation snapshot folded in as `before` for the update diff |
| `requireAuth` / `allowAnonymous` | auth gate toggles (default `requireAuth: true`) |
| `permissionModule` / `fallbackFlag` | permission check + unconditional special-permission re-admit |
| `permissionOverride` | conditional re-admit callback (data-dependent); rule-of-three escape hatch |
| `validate` | per-method input shape check |

`buildStandardPayload` (`server/mutation-pipeline.ts:88`) produces: `insert → { id: result, ...payload }`, `update → { id, changes(, before) }`, `remove → { id }`. `snapshotTouchedFields(doc, changes)` keys the `before` map identically to `changes` (supporting dotted paths via `getByPath`) so the diff view can zip the two without path-matching.

### Foreign-key integrity & rich text (in the CRUD bodies)

The generated bodies delegate two cross-cutting concerns:

- **FK integrity** — `validateForeignKeys` on insert, `validateForeignKeysForUpdate` (full post-`$set` document, decision O-6) on update, and `enforceIntegrityOnDelete` on delete. Edges are declared as `foreignKeys` on each registry entry. Full mechanics live in [referential-integrity.md](./referential-integrity.md).
- **Rich-text sanitization** — `HTML_FIELDS` (`server/crud.lib.ts:89`) maps the only two rich-text fields (`briefingTemplates.content`, `events.description`) to a `sanitizeHtmlFields` pass on every insert/update before the write (ADR 0001), so MongoDB never stores hostile markup. Kept inline rather than as a registry field per the Rule of three (2 sites).

## Custom methods opting into the pipeline

A bespoke method (body isn't plain CRUD) gets the same lifecycle by calling `runMutation` directly — this is why there is exactly one pipeline implementation regardless of entry door. Pattern (`server/apis/members.server.ts`, `server/apis/integrity.server.ts`):

```ts
'members.insert': async function (payload: Record<string, unknown> = {}): Promise<string> {
  return runMutation(
    { userId: this.userId },                       // ctx
    {                                               // descriptor: gates + audit
      collection: 'members', operation: 'create',
      action: 'members.created', auditShape: 'insert',
      permissionModule: 'members',
      redact: COLLECTION_REGISTRY.members.redact?.insert,
      validate: ([p]) => validateObject(p, false),
    },
    [payload] as const,                             // args
    async ([p]) => {                                // body: the custom step
      await validateForeignKeys('members', p);      // same FK semantics as generic CRUD
      return Accounts.createUserAsync(p as …);       // custom: not Collection.insertAsync
    },
  );
}
```

Real opt-in sites and what they add beyond generic CRUD:

| Method | Why it's custom |
|--------|-----------------|
| `members.insert` | `Accounts.createUserAsync` instead of `insertAsync`; opts into FK validation explicitly |
| `members.update` | `permissionOverride` (spec-only edit re-admit) + squad-scope reject in the body |
| `integrity.preview` / `previewBulk` | validate `collection in COLLECTION_REGISTRY` first, resolve `targetModule` from the registry, then run a read-only `operation: 'delete'` preview |

Because `runMutation` takes an explicit `ctx` (carrying `userId`), unit tests can drive the lifecycle directly without `Meteor.callAsync`.

## Adding a collection (5-step checklist)

From CLAUDE.md → *Adding New Collections*. The type system enforces most of it:

1. Create `imports/api/collections/<foo>.collection.ts`.
2. Add `'foo'` to the `CrudCollectionName` union in `imports/api/types/`. **This forces the rest** — the union is the source of truth for two `Record<CrudCollectionName, _>`-typed structures.
3. Add `foo: FooCollection` to the `COLLECTIONS` map / `getCollection()` switch in `server/crud.lib.ts` (alphabetical).
4. Call `createCollectionMethods('foo')` + `createCollectionPublish('foo')` — in practice add `'foo'` to `collectionNames` in `server/main.ts` (the loop does both).
5. Add the `COLLECTION_REGISTRY` entry in `server/collection-registry.ts` (at minimum `{ module }`).

**Why omitting the registry entry is a compile error:** `COLLECTION_REGISTRY` is typed `Record<CrudCollectionName, CollectionRegistryEntry>` and `COLLECTIONS` is `{ [K in CrudCollectionName]: … }`. A mapped/Record type over the union *requires* a key for every union member, so the moment step 2 adds the name, TypeScript flags both the missing registry entry and the missing collection-map entry until you complete steps 3 and 5. (`permissions.test.ts` has a runtime shape-conformance test that catches the same omission under loosened type checks.)

## Registry fields (`CollectionRegistryEntry`)

See CONTEXT.md → **CollectionPermissionRegistry**. The registry holds plain values only — no predicate functions, no string-key DSLs.

| Field | Meaning | Example |
|-------|---------|---------|
| `module` (required) | permission module for `checkPermission`; several collections ride on a parent module | `attendances → 'events'`, `profilePictures → 'members'` |
| `fallback` | unconditional special-permission flag per `create`/`update` that re-admits a denied call | `events.create → 'canCreateEvents'`, `tasks → 'canManageTasks'` |
| `allowsAnonymous` | per-op carve-out for `null` userId: `insert` opens the method, `read` opens the publication | `registrations.insert`, `discoveryTypes.read` |
| `redact` | per-op (`insert`/`update`) field paths stripped from the audit payload | `members → ['password']` |
| `foreignKeys` | outgoing FK edges; inverted to incoming edges at boot in `server/integrity` | see `events`, `members`, `tasks` |
| `displayField` | dotted path used as the human-readable sample in `block` errors' `blockedBy` | `members → 'profile.name'` |
| `aiContext` | optional one-line agent hint; **purely informational, nothing in the CRUD/mutation path reads it** | `attendances`, `events`, `members` |

## Gotchas

- **The delete method is `<c>.remove`, not `<c>.delete`** — the permission op is `'delete'`, but the registered method name and the audit denial segment are `remove` (via `OP_TO_DENIAL_SEGMENT`).
- **`logs` is exempt from auditing** — `auditAllowed = collection !== 'logs'` leaves `action` undefined so CRUD on logs doesn't recursively log itself.
- **`bulkRemove` logs inside the body, not via the pipeline** — it omits `action`/`auditShape` and calls `createLog` per id, so partial failures still leave per-id audit entries and the loop continues past errors (returns `{ removed, errors }`).
- **Update validates the *whole* post-`$set` FK set, not just touched fields** — `validateForeignKeysForUpdate` merges the modifier onto the stored doc; pre-existing orphans must be cleared by the orphan migration before this is safe in production.
- **Pre-existing out-of-range registrations stay editable** — `INSERT_VALIDATORS` (id 1000–9999, age ≥16) gate `.insert` only, by design (#260); update is intentionally not gated.
- **Forgetting the registry / collection-map entry is a compile error** — both are `Record`/mapped types over `CrudCollectionName`; add the entry, don't reach for `as` casts to silence it.
- **Sync vs async collection methods** — bodies must use `findOneAsync` / `insertAsync` / `updateAsync` / `removeAsync` / `countDocuments` / `fetchAsync`; never the sync variants.
- **`permissionModule` differs from the collection name** for module-riding collections (`attendances`, `profilePictures`, `questionnaireResponses`); generated methods read it from the registry, but custom methods and UI `Section`s must pass the right module explicitly.
- **`audit` overrides `auditShape`** — if a descriptor sets both, the custom `audit` function wins and owns its own redaction (the `redact` list is ignored on that path).
- **Rule of three** governs registry field vs inline code: `HTML_FIELDS`, `INSERT_VALIDATORS`, and `permissionOverride` are deliberately inline because they appear in only 1–2 sites.

## See also

- [request-lifecycle.md](./request-lifecycle.md) — how a client call/subscription reaches these generated methods and publications.
- [permissions-rbac.md](./permissions-rbac.md) — `checkPermission` / `checkSpecialPermission` and the role-cache the pipeline gates on.
- [referential-integrity.md](./referential-integrity.md) — the FK subsystem the CRUD bodies delegate to (edge graph, delete cascade, write validation, orphans).
- [server-apis.md](./server-apis.md) — the custom `*.server.ts` methods that opt into `runMutation` alongside the generated ones.
- [data-model.md](./data-model.md) — the collections and field shapes the engine operates over.
- CONTEXT.md → **MutationWithAudit** (lifecycle doctrine), **CollectionPermissionRegistry** (registry fields), **Rule of three** (registry-vs-code discipline).
- `docs/collections.md`, `docs/views-and-forms.md`; CLAUDE.md → *Adding New Collections* / *Server-Mutation Lifecycle* / *CRUD Generation* / *Common Gotchas*; `docs/adr/` (ADR 0001, rich-text sanitize-on-write).
