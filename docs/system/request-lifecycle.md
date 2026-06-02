# Request Lifecycle (client call to DB and back)

The end-to-end path a request travels: the write path (React form → Meteor method → MongoDB, with auth/permission/validation/audit) and the reactive read path (React hook → publication → MongoDB cursor → minimongo). This is the spine every feature in the app branches from — most other system docs describe one stage of it.

## Key files

| Path | Role |
|------|------|
| `client/main.tsx` | Client entry — mounts `<ReactTarget />` on `Meteor.startup`. No router; routing is pathname-based. |
| `imports/ui/hooks/useMethod.ts` | The MethodCall seam — React adapter over `Meteor.callAsync`; wires `loading`/`error`/`data` and antd feedback. |
| `imports/ui/hooks/runMethodCall.ts` | Pure policy core of MethodCall — `unknown → Meteor.Error` narrowing, notify/success policy, discriminated `MethodResult`. |
| `imports/ui/hooks/useEntityForm.ts` | The EntityForm seam — owns the create-vs-update submit lifecycle on top of `useMethod`. |
| `imports/ui/hooks/entityFormSubmit.ts` | Pure logic core of EntityForm — `isUpdate` rule, method-name derivation, arg shaping, frame resolve value. |
| `server/crud.lib.ts` | Generic CRUD factory — `createCollectionMethods` (write/read methods) and `createCollectionPublish` (reactive read). |
| `server/mutation-pipeline.ts` | `runMutation` — the single server mutation lifecycle: auth → permission → validate → body → audit, plus `.denied` entries and telemetry. |
| `server/main.ts` | Server setup — `checkPermission`/`getUserRole` (role cache), `validate*` helpers, `assertSafeSelector`, startup (dev admin, settings bootstrap, indexes), CRUD registration loop. |
| `server/collection-registry.ts` | `COLLECTION_REGISTRY` — per-collection module/fallback/anonymous/redact/FK metadata read by the factory. |
| `server/telemetry.ts` | `instrument()` — times each method body, classifies `ok`/`denied`/`error`, re-throws untouched. |
| `imports/ui/section/Section.tsx` | Representative consumer — `useSubscribe`/`useFind` for reads, `useMethod` for deletes. |

## How it works

Two distinct mechanisms share the same auth/permission/validation gates:

- **Write path** — an imperative RPC over DDP: client calls a Meteor *method*, the server runs it once through `runMutation`, returns a value (or throws), and writes an audit log.
- **Read path** — a reactive *publication*: client `useSubscribe`s to a collection name, the server publishes a Mongo cursor, and matching documents are streamed into the client's in-memory minimongo. `useFind` reruns against minimongo as documents arrive. No method call, no per-read audit log.

Both are generated mechanically per collection by `server/crud.lib.ts` (`createCollectionMethods` + `createCollectionPublish`), driven from `COLLECTION_REGISTRY`. `server/main.ts:376-384` loops over `collectionNames` registering both; `events` is in `methodOnlyCollections` and gets methods only (no publication).

### Write path — editing a squad (concrete trace)

1. **Form submit** — `SquadsForm` (`imports/ui/squads/SquadsForm.tsx`) renders `<Form onFinish={onFinish}>`, where `onFinish` comes from `useEntityForm({ collection: 'squads', created, updated, toPayload })`.
2. **Create vs update** (`entityFormSubmit.ts`) — `entityIsUpdate(hasUser, modelId)` is true only when a user is logged in *and* the model has an `_id`. `entityMethodName` → `squads.update`; `entityArgs` → `[modelId, payload]` (insert would be `[payload]`). `toPayload` maps antd form values to the wire shape.
3. **MethodCall** — `useEntityForm` holds a `useMethod('squads.update', { success: t(updated) })`. Calling `call(...)` flips `loading`, then delegates to `runMethodCall` (`runMethodCall.ts`), which invokes `Meteor.callAsync('squads.update', id, payload)` over DDP.
4. **Server method** — `crud.lib.ts:224` (``[`${collection}.update`]``) wraps everything in `runMutation({ userId: this.userId }, descriptor, [id, data], body)`.
5. **`runMutation` gates** (`mutation-pipeline.ts:146`), in order:
   | Stage | What runs | On failure |
   |-------|-----------|-----------|
   | Auth | reject anonymous unless `allowAnonymous`/`requireAuth: false` | emit `<col>.update.denied`, throw `401` |
   | Permission | `checkPermission(userId, module, 'update')`, then `fallbackFlag` via `checkSpecialPermission`, then `permissionOverride` | emit `.denied`, throw `403` |
   | Validate | `descriptor.validate(args)` — for update: `validateString(id)`, `validateObject(changes)` | emit `.denied`, re-throw the validation error |
   | captureBefore | `findOneAsync` + `snapshotTouchedFields` → pre-update values for the audit diff | n/a (snapshot only) |
   | Body | the actual mutation (`bodyStarted = true` from here) | error propagates **untouched** (no `.denied`) |
   | Audit | `createLog(action, payload)` after the body succeeds | — |
6. **Body** (`crud.lib.ts:249`) — `sanitizeHtmlFields` (no-op for squads; only `events.description`/`briefingTemplates.content`), `validateForeignKeysForUpdate` against the merged post-`$set` document, then `Collection.updateAsync({ _id }, { $set: changes })`. (`roles` updates also `clearRoleCache`.)
7. **Audit** — `auditShape: 'update'` builds `{ id, changes, before }` (with `registryEntry.redact?.update` keys stripped) and `createLog('squads.updated', payload)`.
8. **Return** — the update count flows back over DDP. `runMethodCall` resolves `{ ok: true, data }`, fires `message.success(...)`, and `useEntityForm.onFinish` calls `resolve(modelId)` to close the drawer.
9. **UI refresh** — no manual refetch: the squad was changed in Mongo, so the reactive publication (below) pushes the new document into every subscribed client's minimongo, and open `useFind`s rerender.

`MethodResult<T>` is a discriminated union — `{ ok: true; data }` | `{ ok: false; error }` — never a bare `T | undefined`, so a method that legitimately resolves to nothing (e.g. `*.remove`) is still unambiguously a success.

### Read path — subscribing to a collection (concrete trace)

`Section` (`imports/ui/section/Section.tsx:102-103`) is the canonical consumer:

```ts
useSubscribe(collectionName, filter, options);
const datasource = useFind(() => Collection.find(filter, options), [Collection, filter, options]);
```

1. **Subscribe** — `useSubscribe('squads', filter, options)` opens a DDP subscription to the publication named after the collection.
2. **Publication** (`crud.lib.ts:140`, async handler):
   | Guard | Behaviour |
   |-------|-----------|
   | Anonymous | `if (!this.userId && !allowsAnonymousRead) return this.ready()` — empty result, no error |
   | Selector | `validateObject(filter/options)` + `assertSafeSelector(filter)` (rejects `$where`/`$expr`/`$function`/`$accumulator`) |
   | Permission | `checkPermission(this.userId, module, 'read')` unless anonymous-readable; on deny `this.ready()` then throw `403` |
   | Limit | clamps `options.limit` to `DEFAULT_PUBLISH_LIMIT` (100), capped at `MAX_PUBLISH_LIMIT` (1000) |
3. **Cursor** — returns `Collection.find(filter, limitedOptions)`. Meteor's livedata streams the matching docs and pushes incremental `added`/`changed`/`removed` updates into the client's minimongo.
4. **Reactive query** — `useFind` runs `Collection.find(...)` against minimongo and reruns whenever the cursor's results change, re-rendering the table. The dep array `[Collection, filter, options]` controls when the *query* is re-created.

Reactive reads go through the publication, **not** through a method, so they never hit `runMutation` and emit no audit log. The generated `.read`/`.count`/`.options` *methods* exist for one-shot, non-reactive reads (e.g. `squads.options` in a `CollectionSelect`) and *do* run through `runMutation` with `operation: 'read'` (permission-checked, but no audit `action`). `events` has no *generic factory* publication (it is listed in `methodOnlyCollections`), but a hand-rolled `events` publication in `server/apis/events.server.ts` serves its reactive reads — the Events table subscribes to it via `Section`/`useSubscribe`.

### Permission resolution (shared by both paths)

`checkPermission(userId, module, operation)` (`server/main.ts:125`):

- `getUserRole` reads the user's `profile.roleId`, fetches+normalizes the role, and caches it for `CACHE.roleTtlMs` (~1 min); admin roles (`roles === true`) short-circuit to `true` for everything.
- `normalizeRolePermissions` expands a `module: true` shorthand into the full `{ read, create, update, delete }` object. Boolean modules (`dashboard`, `orbat`, `logs`, `settings`) are a plain `=== true` check; CRUD modules check `permission[operation] === true`.
- `clearRoleCache(roleId)` is called on any `roles` insert/update/delete so a permission change takes effect without waiting out the TTL.

### Validation helpers (`server/main.ts`)

Each `validate*(value, optional = false)` throws `Meteor.Error` on a type mismatch and acts as a TS assertion (`asserts value is T`). Available: `validateString`, `validateNumber`, `validateBoolean`, `validateDate`, `validateArray`, `validateArrayOfStrings`, `validateObject`, `validateUserId`. `assertSafeSelector` recursively rejects code-execution Mongo operators in any client-supplied filter — wire it into every untrusted read path.

### Server startup (`server/main.ts:343-353`)

On `Meteor.startup`: in non-production `createTestData()` seeds the `admin`/`admin` dev user; `bootstrapAdminFromSettings()` seeds a first admin from `Meteor.settings.bootstrapAdmin` **only** when the users collection is empty (prod/preview cold start, no-op otherwise); `createDatabaseIndexes()` builds the query/TTL/unique indexes. The CRUD registration loop (`:376`) wires every collection's methods + publications.

### Outcome classification & telemetry

`runMutation` runs inside `instrument(method, body, classify)` (`server/telemetry.ts`). `bodyStarted` distinguishes a **pre-body denial** (`'denied'`) from a **body error** (`'error'`); success is `'ok'`. Telemetry is purely additive — the body's return value and thrown errors propagate unchanged.

## Request states

| State | Write path (method) | Read path (publication) |
|-------|--------------------|--------------------------|
| Unauthorized | `401` + `<col>.<op>.denied` audit | empty result (`this.ready()`), no error |
| Forbidden | `403` + `.denied` audit | `403` after `this.ready()` |
| Invalid input | validation `Meteor.Error` + `.denied` audit | `400` (selector/object validation) |
| Success | result returned, `<col>.<op>.<created\|updated\|deleted>` audit | docs streamed to minimongo |
| Body error | original `Meteor.Error` propagates, **no** `.denied` audit | n/a |

## Gotchas

- **Reactive reads bypass the method pipeline.** `useSubscribe` → publication, not a method. The generated `.read`/`.count`/`.options` methods are for one-shot non-reactive reads only and emit no audit log.
- **`useFind` needs a live `useSubscribe`.** Without the subscription the data never arrives; a missing/stale dep array on `useFind`/`useCallback`/`useMemo` is the usual "data won't load / won't update" bug (CLAUDE.md → Common Gotchas).
- **Body errors are not denials.** Once `bodyStarted` flips, a thrown `Meteor.Error` reaches the caller intact and emits **no** `.denied` entry. Only pre-body gate failures emit `<col>.<op>.denied`.
- **Anonymous read is silent, anonymous mutate is loud.** A publication returns an empty set for unauthorized callers (`this.ready()`); a mutation throws `401`/`403`. Don't read "empty table" as "permission granted, no rows".
- **Permission cache TTL.** Role changes can lag up to ~1 min unless `clearRoleCache` runs — which the `roles` CRUD ops already do; a manual DB edit to a role will not.
- **Use `App.useApp()` for feedback inside drawers.** `useMethod` pulls `message`/`notification` from the contextual `App.useApp()`; the static antd singletons won't render inside drawer/modal context.
- **`permissionModule` prop on `Section`.** When the collection name differs from its permission module, pass `permissionModule` or the permission check resolves the wrong module.
- **FK validation is whole-document on update.** `validateForeignKeysForUpdate` validates every FK on the *merged post-`$set`* doc, not just touched fields — an unrelated edit can fail on a pre-existing orphaned FK.
- **Selector safety is opt-in per path.** Only paths that call `assertSafeSelector` reject `$where`/`$expr`/`$function`/`$accumulator`; a new read path that forwards a client filter must call it explicitly.
- **`events` uses a custom publication, not the generic factory.** Adding a method-only collection to `collectionNames` instead of `methodOnlyCollections` (or vice versa) silently breaks its read path.

## See also

- `CONTEXT.md` → **MethodCall** (client seam), **MutationWithAudit** (server lifecycle), **CollectionPermissionRegistry** (`COLLECTION_REGISTRY`), **EntityForm** (create-vs-update form lifecycle), **DrawerStack** (how forms `resolve`/`cancel`), **Rule of three** (why some variations stay inline).
- `CLAUDE.md` → "Server-Mutation Lifecycle", "CRUD Generation", "Permission System", "Validation", "Common Gotchas".
- `docs/collections.md` — per-collection field schemas (the payload shapes that flow through this path).
- `docs/views-and-forms.md` — the UI surfaces that originate these calls.
- `docs/adr/` — ADR 0001 (rich-text sanitization on the write path).
