# Referential Integrity Subsystem

Keeps cross-collection references consistent: it blocks/cleans up dangling foreign keys when a document is deleted, validates FK fields on every write, and reports/repairs pre-existing orphans. It is a deep module (`server/integrity/`) that reads the foreign-key edges declared on `COLLECTION_REGISTRY` and is wired into the generic CRUD engine and the custom `members.*` paths.

## Key files

- `server/integrity/index.ts` — barrel re-exporting the public API (`./integrity`, `../integrity`, `/server/integrity`); the concern-split is invisible to callers.
- `server/integrity/types.ts` — shared interfaces (`IncomingEdge`, `IntegrityEffects`, `IntegrityPreview`, `BulkIntegrityPreview`, `WrittenFK`, `OrphanRecord`, `TraversalMode`) + `SAMPLE_LIMIT = 5`.
- `server/integrity/edges.ts` — inverted incoming-edges index (memoized), dotted-path reader, display-name resolver, Mongo edge-selector builder. Pure data shaping over the registry; no Meteor imports.
- `server/integrity/traversal.ts` — `traverseIntegrityEdges`, the single recursive graph walk powering both preview and execute, plus the four delete primitives.
- `server/integrity/delete.ts` — `enforceIntegrityOnDelete` (block-then-execute entrypoint) and `buildRemoveAuditPayload`.
- `server/integrity/preview.ts` — `previewIntegrity` / `previewIntegrityBulk`, non-mutating reads for the delete-confirmation modal.
- `server/integrity/writeValidation.ts` — write-time FK validation: touched-fields introspection (insert) + full-document merge-and-validate (update, decision O-6).
- `server/integrity/orphans.ts` — `scanForOrphans` (read-only graph walk) and `resolveOrphans` (one-off migration).
- `server/apis/integrity.server.ts` — Meteor methods `integrity.preview`, `integrity.previewBulk`, `integrity.scan`, `integrity.scanResolve`.
- `scripts/integrity-scan.ts` — `runScan` / `runResolve` for `meteor shell` (npm script `integrity-scan`).
- `server/collection-registry.ts` — `COLLECTION_REGISTRY` where every `foreignKeys` edge is authored (per-source / outgoing).
- `docs/prds/referential-integrity-infrastructure.md` — the spec (decisions O-6, RULE-027, per-edge policy table, 27 user stories).

## How it works

### The FK edge graph

Each collection authors its **outgoing** edges as `foreignKeys?: readonly ForeignKeyEdge[]` on its `COLLECTION_REGISTRY` entry (`server/collection-registry.ts`). An edge is:

| Field | Meaning |
|-------|---------|
| `field` | dotted path on the *source* doc (e.g. `profile.rankId`, `attendees`) |
| `target` | the `CrudCollectionName` it points at |
| `kind` | `scalar` (single id string) or `array` (list of id strings) |
| `onDelete` | policy when the *target* is deleted: `block` / `setNull` / `pull` / `cascade` |

At first read, `buildIncomingEdges()` (`edges.ts:24`) **inverts** the per-source map into a per-target `Map<target, IncomingEdge[]>`, memoized in `cachedIncomingEdges`. `getIncomingEdges(target)` is the lookup the traversal uses: "who points at me?". `resetIncomingEdgesCache()` is a test-only seam for injecting synthetic registry edges (e.g. a self-cascade cycle probe).

The current registry declares 8 collections with edges (events, members, questionnaireResponses, ranks, registrations, specializations, squads, tasks). Note self-referential edges: `ranks.previousRankId/nextRankId → ranks`, `squads.parentSquadId → squads`, `tasks.parent → tasks`. These work without special-casing — `setNull` on a self-reference is just another edge.

### Delete cascade and preview (the shared traversal)

Both delete-enforcement and preview run the *same* `traverseIntegrityEdges(target, targetId, ctx, mode, visited)` (`traversal.ts:55`). `mode` is `'preview'` (count + sample only) or `'execute'` (count + apply mutation). Keeping one walk is the load-bearing guarantee that the preview is a faithful contract for what execute does (PRD story 26).

For each incoming edge of the target:

| `onDelete` | Preview reports | Execute applies | Notes |
|-----------|-----------------|-----------------|-------|
| `block` | `blockedBy: [{ source, count, sample[] }]` | nothing (caller throws) | `sample` is up to `SAMPLE_LIMIT` display names |
| `pull` | `effects.pulled[source] += count` | `$pull: { field: targetId }`, `multi` | clears one array element; scalar+array share equality syntax |
| `setNull` | `effects.setNull[source] += count` | `$set: { field: null }`, `multi` | works on self-referential edges |
| `cascade` | recurse, then `effects.cascaded[source] += n` | recurse, then `removeAsync` each | child's own integrity rules fire first (grandchildren cleaned before parent) |

`enforceIntegrityOnDelete` (`delete.ts:10`) runs the walk **twice**: a `preview` pass first to collect blockers, and if any `blockedBy` entry fired it throws `Meteor.Error('foreign_key_blocked', 'Cannot delete: in use by …', { blockedBy })` *before mutating anything* (block has primacy). Only if clean does it run the `execute` pass and return `IntegrityEffects`. The two passes are **not atomic** — a documented TOCTOU trade-off accepted for the admin tool's low-concurrency profile.

`buildRemoveAuditPayload(id, effects)` (`delete.ts:47`) returns the historical `{ id }` shape, attaching `cascadeEffects: effects` only when at least one primitive produced an effect — so non-cascading deletes keep their old audit shape.

`previewIntegrity` / `previewIntegrityBulk` (`preview.ts`) run only the `preview` pass. The bulk variant races N `previewIntegrity` calls via `Promise.all` (each builds its own `visited` set, so they are independent), returning `{ perId, aggregate, blockedIds }` — one round-trip for the bulk-delete modal.

**Cycle break:** the walk keys `visited` on `${target}:${targetId}`; a repeat returns empty effects. Real registries shouldn't cycle (cascade is reserved for owned relationships), but this prevents a hang from a mistaken registry.

**Idempotence invariant:** execution is best-effort sequential with no transactions, so every mutation must be a no-op on retry — `$pull` on an already-pulled array, `$set: null` on an already-null field, and `removeAsync` on a missing doc all satisfy this. Do not add non-idempotent logic (counters, log-array appends) inside a primitive (`traversal.ts:11-17`).

**Squad scope:** `buildSampleSelector` (`traversal.ts:38`) applies `getSquadScope(ctx.userId)` only to `members`-source *samples* (so an officer's preview doesn't leak names outside their scope). Counts are deliberately **not** scoped, so the modal is honest about total impact.

### Write-time FK validation

Fires before the Mongo write on insert and update, from both generic CRUD and the custom `members.*` paths. Decision **O-6** enforces *full-document* integrity: every FK on the *resulting* document must resolve to a live target, not only the fields a given write touched (supersedes the earlier touched-fields-only RULE-027).

| Function (`writeValidation.ts`) | Used by | Behavior |
|--------------------------------|---------|----------|
| `extractWrittenFKs(source, modifier)` | insert path + unit tests | introspects `$set`/`$push`/`$addToSet` (and bare docs); skips `$unset`/`$pull` (clears never orphan) |
| `collectForeignKeyValues(source, doc)` | full-doc path | yields every (edge, value) present on a complete doc |
| `applyModifierToDoc(stored, modifier)` | update path | merges `{ $set: changes }` onto a clone; **`$set`-only — throws `unsupported_modifier` on any other operator** |
| `validateForeignKeys(source, modifier)` | insert | asserts touched FKs exist |
| `validateForeignKeysOnDoc(source, doc)` | — | asserts every FK on a doc exists |
| `validateForeignKeysForUpdate(source, stored, modifier)` | update | merges then validates the whole result; `undefined` stored = no-op (concurrent removal) |

`assertReferencesExist` (`writeValidation.ts:210`) dedupes (target, value) pairs and races a `findOneAsync({ _id: value })` per unique pair, throwing `Meteor.Error('foreign_key_invalid', '<field> references non-existent <target> <value>', { field, target, value })` on the first miss.

### Orphan scan and migration

`scanForOrphans()` (`orphans.ts:55`) walks every edge against the live DB: for each edge it maps distinct referenced ids → source-doc ids, batch-checks existence with one `$in` query against the target, and emits an `OrphanRecord { source, field, sourceId, orphanedTargetId }` per dangling reference. Read-only; safe on production.

`resolveOrphans({ dryRun })` (`orphans.ts:107`) is the **one-off migration** that must run *before* O-6 enforcement is enabled on a populated DB — otherwise edits to already-orphaned rows start failing. It applies each edge's declared primitive to the dangling reference:

| Edge `onDelete` | Resolution |
|-----------------|-----------|
| `pull` | `$pull` the orphaned id → counted in `pulled` |
| `setNull` | `$set: null` → counted in `setNull` |
| `block` / `cascade` / unknown | left untouched, returned in `skipped[]` for manual operator reconciliation |

It keys the on-delete policy by `${source}:${field}` (a field name is only unique within a collection).

## API surface (`server/apis/integrity.server.ts`)

| Method | Args | Permission gate | Returns |
|--------|------|-----------------|---------|
| `integrity.preview` | `(collection, id)` | target collection's own `module`, op `delete` | `IntegrityPreview` |
| `integrity.previewBulk` | `(collection, ids)` | target's `module`, op `delete`; rejects empty / >100 | `BulkIntegrityPreview` |
| `integrity.scan` | `()` | **admin-only** via synthetic `__admin_only__` module | `OrphanRecord[]` |
| `integrity.scanResolve` | `(dryRun = false)` | **admin-only** `__admin_only__` | `OrphanResolution` |

All four route through `runMutation` (`server/mutation-pipeline.ts`), so denials emit standard `<action>.denied` audit entries. Unknown collections are rejected with `Meteor.Error(400, 'Invalid collection')` *before* `runMutation`, so the permission check always has a real module.

The `__admin_only__` gate is deliberate: `checkPermission` in `server/main.ts` short-circuits to `true` for admins (`role.roles === true`) before reading the module name, so admins pass; every non-admin role falls through to the module-not-recognised branch and is denied. `integrity.scan` is gated this broadly because its result reveals every collection's id space at once.

`scripts/integrity-scan.ts` exposes `runScan()` and `runResolve(dryRun = true)` for `meteor shell`. The `npm run integrity-scan` script pipes a one-liner that imports the module and calls `runScan`. The full migration runbook (dry-run → review `skipped` → apply → re-scan) lives in the file header.

## Integration with CRUD and the registry

The generic CRUD factory (`server/crud.lib.ts`) wires integrity into every collection's methods:

| CRUD method | Integrity call site |
|-------------|---------------------|
| `.insert` (`crud.lib.ts:219`) | `validateForeignKeys(collection, payload)` after HTML sanitize, before `insertAsync` |
| `.update` (`crud.lib.ts:258-259`) | re-fetch stored doc → `validateForeignKeysForUpdate(collection, stored, { $set: changes })` before `updateAsync` |
| `.remove` (`crud.lib.ts:287`) | `enforceIntegrityOnDelete` → `removeAsync`; audit via `buildRemoveAuditPayload(r.id, r.effects)` |
| `.bulkRemove` (`crud.lib.ts:322-325`) | per-id `enforceIntegrityOnDelete` + `removeAsync`; logs each with `buildRemoveAuditPayload`; per-id failures collected into `errors[]`, not fatal |

The custom `members.*` paths (`server/apis/members.server.ts`) call the same helpers explicitly because they don't go through the generic factory: `members.insert` → `validateForeignKeys` (`:152`); `members.update` → `validateForeignKeysForUpdate` (`:212`); `members.remove` → `enforceIntegrityOnDelete` (`:252`), then the **one** owned-target cascade not in the registry — deleting a member also deletes its `ProfilePicture` and manually bumps `effects.cascaded.profilePictures`.

On the client, `imports/ui/section/Section.tsx` calls `integrity.preview` / `integrity.previewBulk` before showing the delete-confirm modal; `imports/ui/section/DeleteImpactPreview.tsx` renders the `blockedBy` / effect panels and disables the confirm button when blocked.

## Data shapes

```ts
IntegrityEffects   = { pulled, setNull, cascaded: Partial<Record<CrudCollectionName, number>> }
IntegrityPreview   = IntegrityEffects & { blockedBy: { source, count, sample: string[] }[] }
BulkIntegrityPreview = { perId: Record<id, IntegrityPreview>, aggregate: IntegrityPreview, blockedIds: string[] }
OrphanRecord       = { source, field, sourceId, orphanedTargetId }
OrphanResolution   = { pulled: number, setNull: number, skipped: OrphanRecord[] }
```

Stable error codes for clients (PRD stories 21-22): `foreign_key_blocked` (with `details.blockedBy`), `foreign_key_invalid` (with `details.{field,target,value}`), `unsupported_modifier`.

## Gotchas

- **Run the orphan migration before enabling O-6 on a populated DB.** Full-document update validation rejects an edit to *any* field if the merged doc carries a dangling FK in an *untouched* field. Pre-existing orphans must be cleared with `integrity.scanResolve` / `runResolve` first, or unrelated edits start failing.
- **`applyModifierToDoc` is `$set`-only and fails loud.** It throws `unsupported_modifier` on `$push`/`$pull`/`$inc`/etc. The array-operator writes in `events.server.ts` (`$pull`/`$addToSet` on attendees) and `tasks.server.ts` (`$push` on comments) go through a *direct* `Collection.updateAsync` and never reach this validator. A future caller that needs another operator must extend it deliberately — do not silently merge unknown operators (that would bypass FK validation).
- **Enforce and preview must stay equivalent** — both run `traverseIntegrityEdges`. Don't fork the logic; the preview is a contract the execute pass honors.
- **Mutations must be idempotent.** Best-effort sequential execution with no transactions relies on `$pull`/`$set:null`/`removeAsync` being no-ops on retry. Never add a counter-bump or log-append inside a primitive.
- **Block counts are unscoped, samples are squad-scoped.** Only `members`-source *samples* honor `getSquadScope`; counts always reflect total impact. Don't "fix" this asymmetry.
- **Cascade recurses depth-first.** A cascaded child's own integrity rules fire (and its blockers propagate up) *before* it is removed — block has primacy at every level, and a deep blocker aborts the whole top-level delete.
- **TOCTOU between preview and execute.** A concurrent insert between the block-check pass and the execute pass can leave a freshly-orphaned id. Accepted for the low-concurrency admin tool.
- **The owned-target ProfilePicture cascade is not in the registry.** It is hand-coded in `members.remove` (reverse-direction ownership, single instance, kept as code per the Rule of three). If a second owned-target edge appears, promote it.
- **Forgetting a registry edge silently drops coverage.** Adding a new FK field without a `foreignKeys` entry means no validation and no cascade. The `Record<CrudCollectionName, _>` type forces a registry *entry* to exist, but not that its edges are complete — there's no compile error for a missing edge.
- **Reset the edge cache in tests** that inject registry overrides — `cachedIncomingEdges` is memoized; call `resetIncomingEdgesCache()`.

## See also

- `CONTEXT.md` → **CollectionPermissionRegistry** (the registry that hosts `foreignKeys`), **MutationWithAudit** (the `runMutation` lifecycle every integrity method routes through), **Rule of three** (why the ProfilePicture cascade stays inline).
- `docs/prds/referential-integrity-infrastructure.md` — full spec, decisions O-6 / RULE-027, per-edge policy assignments, 27 user stories.
- `docs/collections.md` — per-collection field schemas (the source fields the edges reference).
- `docs/views-and-forms.md` — the Section delete-confirm modal UI surface (`DeleteImpactPreview`).
- `CLAUDE.md` → "Adding New Collections" and "Common Gotchas" (registry/CRUD wiring steps).
