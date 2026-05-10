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

### CollectionPermissionRegistry

The single source of per-collection metadata that both the CRUD factory and the `MutationWithAudit` wrapper consult. Lives in `server/collection-registry.ts` as a typed `Record<CrudCollectionName, CollectionRegistryEntry>` — one entry per collection with these fields:

- `module` — the permission module name used for `checkPermission`. Several collections (e.g. `attendances`, `profilePictures`, `questionnaireResponses`) do not own a permission module of their own; they ride on a parent module's permissions, encoded here.
- `fallback` (optional) — unconditional special-permission flag per `create` / `update` op, e.g. `canCreateEvents` for `events.create` or `canManageTasks` for `tasks.{create,update}`. When set, possession of the flag re-admits a denied call.
- `allowsAnonymous` (optional) — per-op carve-out permitting a `null` `userId`. Currently only `registrations.insert` opts in.
- `redact` (optional) — per-op path-list of fields stripped from the audit payload before logging, used by sensitive sites such as `members.insert` to keep secrets out of the audit trail.

The registry holds plain TypeScript values throughout: no predicate functions, no string-key DSLs, no discriminated-union "kind" fields. The `Record<CrudCollectionName, _>` type forces every member of the canonical collection-name union to have an entry — adding a collection to the union without updating the registry is a compile error.

### LocaleSet

The single deep module (`imports/i18n/`) that owns the translation set as one typed object indexed by typed dotted-key. The runtime entry point is `t<K extends LocaleKey>(key: K, params: ExtractParams<typeof translations[K]['en']>): string`.

Source of truth is `imports/i18n/translations.ts` — a flat `Record<DottedKey, Record<Locale, string>>` with `as const satisfies TranslationSet`. The 138 call sites pass dotted strings (`t('common.create')`) unchanged from before; depth comes from what is now structurally impossible:

- **Missing key per locale** — the `{ en: string; de: string; fr: string }` row shape makes a missing translation a compile error at the source, not a runtime fallback to the literal key string.
- **Typo on the call site** — `LocaleKey = keyof typeof translations` makes `t('comon.create')` a compile error.
- **Missing/extra interpolation params** — template-literal-type extraction over `translations[K]['en']` derives the required params per call.
- **Cross-locale drift in nesting structure** — there is no nesting; the structure is the type.

The previous design (three hand-synchronized `locales/{en,de,fr}.json` files + a `getTranslation` walker that returned the key string on miss) had no way to express any of these invariants. The deepening removes the JSON files entirely; the locale set lives once, in TypeScript.

## Doctrines

### Rule of three

Variations in **3+ sites** go in the registry as data; variations in **1–2 sites** stay as code in custom method bodies that opt into the wrapper. This is a falsifiable test for future registry vocabulary changes, and the discipline that keeps the registry inspectable as plain values rather than drifting into a configuration DSL.

When you find yourself wanting to express a new kind of variation in the registry (a new field, a new gate kind, a new shape modifier), the question is empirical: *is this pattern already present in three or more sites?* If yes, promote it to the registry. If no, leave it as code in the body of the one or two methods that need it; revisit when a third site appears. This applies in both directions: a registry field that's used by only one or two sites is a candidate for demotion back to code in those bodies.
