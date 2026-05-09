# Project Context

Project-wide domain language and load-bearing decisions. ADRs go in `docs/adr/`. Per-area docs live in `docs/agents/`.

## Domain terms

### MutationWithAudit

The single deep module (`server/mutation-pipeline.ts`) that owns the standard server-mutation lifecycle. Lifecycle stages, in order:

1. **Authentication** — reject anonymous calls with `Meteor.Error(401, …)` unless the descriptor opts in via `allowAnonymous`.
2. **Permission check** — `checkPermission(userId, module, op)` against the descriptor's `permissionModule`. An optional unconditional `fallbackFlag` (e.g. `canCreateEvents`) re-admits a denied call when set on the user's role.
3. **Input shape validation** — the descriptor's `validate(args)` callback, where each method declares its own `validateString` / `validateObject` / `validateArrayOfStrings` shape checks.
4. **Body invocation** — the unique mutation step the caller supplies as `(args) => Promise<TResult>`.
5. **Audit log emission** — on success only. Standard shapes per op (`insert → { id, ...payload }`, `update → { id, changes }`, `remove → { id }`) are baked in; the descriptor can pass `audit: (args, result) => ({...})` to opt into a custom shape.

On any pre-body failure (auth, permission, validation), the wrapper emits a `<collection>.<op>.denied` audit entry capturing `userId` (and the target `id` for `update`/`remove`) before throwing — closing the previous gap where permission denials produced no audit trail. Body errors propagate untouched: the wrapper does **not** normalize, wrap, or translate them. A body throwing `Meteor.Error('SomeCode', '...')` reaches the caller with `error.error === 'SomeCode'` intact.

The wrapper is exposed as `runMutation(ctx, descriptor, args, body)` with an explicit `ctx` parameter (carrying `userId`), which lets unit tests invoke the lifecycle directly without `Meteor.callAsync`. Both call paths — `createCollectionMethods` (the CRUD factory in `server/crud.lib.ts`) and direct `runMutation` calls from custom methods that opt in — route through the same internal pipeline, so the lifecycle has exactly one implementation regardless of entry door.
