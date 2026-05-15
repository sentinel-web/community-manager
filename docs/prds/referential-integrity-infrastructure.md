# PRD: Referential Integrity Infrastructure

**Status:** Proposed
**Author:** Oke Johannsen
**Last updated:** 2026-05-10

## Problem Statement

The application stores 21 cross-collection references across 13 collections (Members ↔ Ranks, Events ↔ Members, Tasks ↔ TaskStatus, Questionnaires ↔ Responses, etc.) but has zero infrastructure to enforce that those references stay valid.

Today, an administrator can:

- Delete a `Rank` while 50 `Members` still reference it. The members render as "—" in tables and never recover.
- Delete a `Member` and leave their id in `Events.attendees`, `Events.hosts`, `Tasks.participants`, `Tasks.completedBy`, `Specializations.instructors`. The arrays grow stale silently.
- Delete a `Squad` and orphan child squads whose `parentSquadId` now points nowhere.
- Insert or update a `Member` with a fabricated `rankId` that doesn't match any real `Rank`. No validation rejects it.

The UI hides the corruption with nullish-fallback rendering (`rankName || '-'`), so administrators have no signal that anything is wrong. Audit logs record only the source action, never the orphaning side effects. Cleanup requires hand-written Mongo queries.

## Solution

Introduce a per-edge integrity layer that lives alongside the existing `CollectionPermissionRegistry` and `MutationWithAudit` pipeline:

1. **A foreign-key registry** declared per-source as a new structural field on `CollectionRegistryEntry`. Each edge declares its target collection, scalar/array kind, on-delete policy (`block` / `setNull` / `pull` / `cascade`), and a `displayField` for human-readable error messages.
2. **Two enforcement helpers** — `enforceIntegrityOnDelete(collection, id)` runs at delete time; `validateForeignKeys(collection, modifier)` runs at insert/update time. Both extracted into a deep `server/integrity.ts` module called from generic CRUD and from custom mutation bodies.
3. **A delete-impact preview** exposed as `integrity.preview(collection, id)`. The Section confirmation modal pre-fetches the preview and renders structured "this will block" or "this will affect N entities" panels before the admin confirms.
4. **An on-demand orphan scanner** (`scripts/integrity-scan.ts`) that walks the entire FK graph against the live database and reports orphans as JSON, used for awareness — not gated to deploy.

Administrators see structured "in-use-by" errors with sample referencing entities, get informed-consent previews before destructive deletes, and stop accumulating dangling references on every write.

## User Stories

1. As an administrator, I want to be prevented from deleting a `Rank` while members still hold it, so that I don't silently break ORBAT and member displays.
2. As an administrator, when a delete is blocked, I want to see *which* entities are using the value (sample names + counts per source collection), so that I can navigate directly to fix them.
3. As an administrator, I want to delete a `navyRankId` (a soft secondary rank) and have member references automatically cleared, so that I don't have to manually update every member.
4. As an administrator, when I delete a member, I want their id automatically pulled from `Events.attendees`, `Events.hosts`, `Tasks.participants`, `Tasks.completedBy`, and `Specializations.instructors`, so that those collections stay clean.
5. As an administrator, when I delete a `Questionnaire`, I want all its `QuestionnaireResponses` deleted with it, so that orphaned response data doesn't accumulate.
6. As an administrator, when a `Member` is deleted, I want their `respondentId` in past `QuestionnaireResponses` set to null (anonymized), so that historical feedback is preserved without identifying a former member.
7. As an administrator, when I delete a parent `Task`, I want its subtasks to become roots (parent set to null), so that I can decide where to re-parent them rather than losing them.
8. As an administrator, when I delete a parent `Squad`, I want its child squads to become roots, so that they remain visible and re-parentable.
9. As an administrator, when I delete a `Rank` in the middle of a progression chain, I want adjacent ranks' `previousRankId` and `nextRankId` set to null, so that the chain breaks cleanly rather than referencing a phantom.
10. As an administrator, before clicking "Delete" in the section table, I want to see what the delete will affect (block reasons, cascaded counts, pulled counts), so that I can confirm with full information.
11. As an administrator, when a delete will block, I want the confirmation button disabled with the block reasons rendered inline, so that I cannot click through a destined-to-fail action.
12. As an administrator, when I assign a member to a deleted rank by mistake (e.g., copy-paste from old data), I want the insert/update rejected with a clear error code, so that I notice the typo immediately.
13. As an administrator, when I update an unrelated field on a member who already has a stale `rankId` (a pre-existing orphan), I want the update to succeed without forcing me to fix the historical data first.
14. As an administrator, when I `$push` a stale `specializationId` onto `member.profile.specializationIds`, I want the push rejected, so that I don't introduce a new orphan.
15. As an administrator, when a delete cascades 1000 responses, I want a single audit log entry summarizing affected collections and counts, so that the timeline doesn't drown in per-doc events.
16. As an administrator, after a partial integrity failure, I want the audit log to show what succeeded and what failed, so that I can resume cleanup from the right point.
17. As an administrator, I want to retry a failed integrity action without worrying about double-pulls or double-deletes, so that I can recover from transient errors safely.
18. As an administrator, I want to run an orphan scan on demand to see the current state of dangling references, so that I can plan a cleanup before a major release.
19. As a developer, when I add a new collection with foreign keys, I want a compile error if I forget to register its edges, so that integrity coverage cannot regress silently.
20. As a developer, when I add a custom delete method in `server/apis/`, I want a test failure if I forget to call `enforceIntegrityOnDelete`, so that custom paths can't bypass integrity by accident.
21. As a developer, when I read a `block` error, I want the `error.details` payload to follow a stable shape (`{ blockedBy: [{ source, count, sample }] }`), so that the client renderer is uniform across all collections.
22. As a developer, when I write a write-time validation error, I want a stable error code (`foreign_key_invalid`), so that clients can match on the code rather than parse messages.
23. As a developer, when I'm investigating a past delete, I want the audit log entry to carry `cascadeEffects` in its data payload, so that I can reconstruct what was affected without querying the DB.
24. As a developer, when I add a new edge to the registry, I want test coverage for that edge's primitive automatically, so that I don't have to hand-write a per-edge test.
25. As a developer, when integrity logic recurses through a cyclic graph, I want cycle detection to terminate the walk, so that the engine never deadlocks.
26. As a developer, when I call `integrity.preview` and then `enforce`, I want the two to produce the same effect description, so that the preview is a contract the execution honors.
27. As an officer with squad-scoped permissions, when I attempt to delete an entity I have permission to delete, I want the integrity check to respect my read-permission scope when listing referencing entities, so that the preview doesn't leak info about entities outside my scope.

## Implementation Decisions

### Registry shape

- Foreign-key edges declared as a new optional field on `CollectionRegistryEntry`: `foreignKeys?: readonly ForeignKeyEdge[]` and `displayField?: string`. The 21 edges across 13 collections is well past the Rule of Three doctrine threshold; data belongs in the registry.
- `ForeignKeyEdge` carries `field` (dotted path), `target` (canonical collection name), `kind: 'scalar' | 'array'`, `onDelete: 'block' | 'setNull' | 'pull' | 'cascade'`, and an optional `kind: 'owns'` semantic tag for cascade edges.
- Authoring is per-source (outgoing edges) for code locality; the inverted incoming-edges view is computed once at boot inside `server/integrity.ts`.
- The four policy primitives (`block`, `setNull`, `pull`, `cascade`) cover all 21 edges. Recovery semantics (`promote`, `relink`) are deliberately excluded — they belong in feature-specific code, not generic policy.

### Per-edge policy assignments

- **block** — `Members.profile.roleId`, `Members.profile.rankId`, `Events.eventType`, `Tasks.status`. These are load-bearing reference fields the UI/permissions assume to exist.
- **setNull** — `Members.profile.navyRankId`, `Members.profile.positionId`, `Members.profile.squadId`, `Specializations.requiredRankId`, `Registrations.discoveryType`, `QuestionnaireResponses.respondentId`, `Tasks.parent`, `Squads.parentSquadId`, `Ranks.previousRankId`, `Ranks.nextRankId`.
- **pull** — `Members.profile.specializationIds[]`, `Members.profile.medalIds[]`, `Events.hosts[]`, `Events.attendees[]`, `Tasks.participants[]`, `Tasks.completedBy[]`, `Specializations.instructors[]`, `Specializations.requiredSpecializations[]`.
- **cascade** — only `QuestionnaireResponses.questionnaireId` (responses are owned by their questionnaire).
- **Special-case** — `Members.profile.profilePictureId` is owned-target cascade in the reverse direction (deleting a Member should also delete its picture). Handled inline in the `members.delete` body, not via the registry. Single-instance pattern; revisit only if a second owned-target edge appears.

### Engine module (deep)

A new `server/integrity.ts` exposes three async functions and a small set of types. Internal: a shared `traverseIntegrityEdges(collection, id, mode)` powers both `enforce` and `preview`, guaranteeing the preview matches execution.

- `enforceIntegrityOnDelete(collection, id, visited?)` returns an `IntegrityEffects` summary `{ pulled, setNull, cascaded }` keyed by source collection. Throws `Meteor.Error('foreign_key_blocked', message, { blockedBy: [{ source, count, sample }] })` when any `block` edge has matches.
- `validateForeignKeys(collection, modifier)` inspects only the fields actually being written. For `$set` it validates set targets; for `$push`/`$addToSet` it validates the value being added; for `$unset` it skips; for whole-doc replacements it validates all FK fields. A shared `extractWrittenFKs(modifier)` helper covers operator handling and is independently tested.
- `previewIntegrity(collection, id)` returns the same shape as `enforce` would produce, without writing.

Engine behavior:

- **Recursive cascade with cycle detection** — `cascade` recurses through the deleted children's own incoming edges, threading a `Set<string>` of `${collection}:${id}` keys to break cycles.
- **Best-effort sequential execution** — each pull/setNull/cascade step runs in order and is idempotent under retry; a step throwing accumulates into a per-step failure list. A summary error `Meteor.Error('integrity_partial_failure', message, { succeeded, failed })` is thrown only at the end if any step failed.
- **No Mongo transactions** — the deployment is single-node MongoDB and idempotent operations cover the realistic failure modes for an admin tool.
- **Order of operations on delete** — child cleanups (`pull`/`setNull`/`cascade`) run *before* removing the target. If anything fails mid-flight, the target still exists and the action is retry-safe.

### Wiring into existing pipeline

- Generic CRUD `.delete` body in `server/crud.lib.ts` calls `enforceIntegrityOnDelete`, then `removeAsync`, returns `{ id, effects }`. The descriptor's `audit(args, result)` callback rolls `effects` into the standard remove-audit payload as `cascadeEffects`. No manual `createLog` calls.
- Generic CRUD `.insert` and `.update` bodies call `validateForeignKeys` before the corresponding async write.
- Custom `members.delete` body keeps its bespoke logic (self-delete check, ProfilePicture cleanup) and adds an explicit `enforceIntegrityOnDelete` call, then returns `{ id, effects }` so the existing `runMutation` audit path captures cascade effects uniformly.

### Audit log shape

- One audit log per source action, regardless of cascade depth. The standard remove-shape payload is extended with a `cascadeEffects: { pulled, setNull, cascaded }` summary blob. No per-doc log entries for cascade or cleanup work. The Logs UI renders `data` as-is so no rendering change is required.

### Preview API

- New `server/apis/integrity.server.ts` exposes a single read method `integrity.preview(collection, id)` wrapped in `runMutation` with `requireAuth: true` and the source collection's `permissionModule` for read. Officers with squad-scoped read see only references they're entitled to read; references outside scope are excluded from the preview's `sample` arrays but still counted (so total counts remain truthful and admins aren't misled into thinking a delete is safe).

### UI integration

- The existing Section delete handler is changed from "open `Modal.confirm` immediately" to "fetch `integrity.preview` first, then open `Modal.confirm` with the preview rendered inside."
- A new component `imports/ui/section/DeleteImpactPreview.tsx` renders the preview: red panel for block reasons (count + sample names per blocking source), yellow panel for cascade/pull/setNull side effects (count per affected source). The confirm button is disabled when `preview.blockedBy.length > 0`.
- Error rendering: extend the existing `notification.error({ description: err.message })` pattern to render `err.details.blockedBy` structurally when present, falling back to `err.message` when absent. Stable error codes (`foreign_key_blocked`, `foreign_key_invalid`, `integrity_partial_failure`) feed i18n via the existing `LocaleSet` keyed by code.

### Existing-orphan handling

- Update-time validation only inspects fields actually present in the modifier — pre-existing orphans (members today with stale `rankId`s) do not block unrelated updates. Orphans surface only when an admin explicitly rewrites the orphaned field.
- A `scripts/integrity-scan.ts` (`npm run integrity-scan`) walks the FK graph and emits JSON `{ source, field, sourceId, orphanedTargetId }` records. Manual run only; not gated to deploy.

### Shipping order

Four PRs, no feature flag:

1. **Registry + engine + primitive tests** — `server/integrity.ts` with full registry data and helper functions; tests cover primitive behavior. No wiring; pure dead code on this PR.
2. **Wire enforcement into CRUD + members.delete** — generic CRUD `.delete`/`.insert`/`.update` and custom `members.delete` integrated. Coverage tests added.
3. **Delete-impact preview modal** — `integrity.preview` method, `DeleteImpactPreview` component, Section delete handler change.
4. **Orphan scanner CLI** — `scripts/integrity-scan.ts`, package.json script entry.

Phase 1 is risk-free dead code. Phase 2 is the behavior-changing phase but lands on top of fully tested helpers. Phase 3 is UI-isolated. Phase 4 is read-only tooling.

## Testing Decisions

A good test for this layer exercises **observable behavior** through the Meteor method surface or the engine's public functions, never internals like the inverted edge map or the visited-set. Given the same inputs (collection, id, current DB state), tests assert the same observable outputs (effects shape, audit log content, post-state row counts) — implementation refactors that change traversal order or memoization should not break tests.

### Tests written

- `tests/integrity.tests.ts` — integration tests against the real test-app DB:
  - Each primitive in isolation: `block` raises with correct `details.blockedBy` shape; `setNull` writes null to scalar fields; `pull` removes ids from arrays; `cascade` deletes referencing rows.
  - Recursive cascade plus cycle detection: synthetic graph with a cycle terminates rather than hangs.
  - Best-effort partial failure: a deliberately injected failure mid-cascade produces an `integrity_partial_failure` error whose `succeeded`/`failed` lists match what the DB ended up in.
  - Preview/execute equivalence: `integrity.preview(c, id)` and the effects field returned from execution produce the same shape.
  - Write validation: insert with bad FK throws `foreign_key_invalid`; update of unrelated field on a stale-FK row succeeds; update that rewrites an FK to a stale value throws; `$push` of a stale id into an array throws.
  - Self-references: deleting a parent `Task` sets children's `parent` to null; deleting a parent `Squad` sets children's `parentSquadId` to null; deleting a `Rank` in a chain sets adjacent `previousRankId`/`nextRankId` to null.
  - Audit log: deleting a Questionnaire with N responses produces exactly one Logs entry with `data.cascadeEffects.cascaded.questionnaireResponses === N`.
  - Members.delete continues to handle ProfilePicture cleanup and self-delete prevention while now also running integrity.

- `tests/integrity-coverage.tests.ts` — static-analysis tests:
  - Every `removeAsync` call in `server/apis/*.server.ts` is preceded by an `enforceIntegrityOnDelete` call (regex-or-AST scan; fails on unguarded paths).
  - Every collection in the canonical `CrudCollectionName` union has a `COLLECTION_REGISTRY` entry whose `foreignKeys` is either present or explicitly an empty array (no implicit "forgot to register").
  - For each registry edge with a `displayField`, the path resolves to a string on a fresh fixture doc.

### Prior art

- The shape-conformance test in `permissions.test.ts` already exercises `COLLECTION_REGISTRY` for completeness under loosened type checks. The new coverage tests follow the same "structural invariants as tests" pattern and live alongside it.
- The integration tests follow the existing `tests/` convention: imports through `tests/main.ts`, Mocha + Node `assert`, real Meteor test-app, fixture cleanup via `cleanupFixtures` (per `tests/integration_e2e_test_patterns.md`).

### What is not tested

- UI component rendering (`DeleteImpactPreview` markup) and Section delete-handler integration. Q13 explicitly scoped these out — the layer's correctness is verified at the engine and method surface, and UI coverage is added opportunistically when the modal is touched. End-to-end Playwright coverage is out of scope for this PRD.

## Out of Scope

- **Mongo transactions** for atomic cascade. The deployment runs single-node MongoDB; transactional rollback would require switching to a replica set. Idempotent operations + best-effort sequential execution are sufficient for the failure profile of an admin tool. Revisit only if a real failure mode shows up in production.
- **Recovery semantics** like auto-promoting children when their parent is deleted (Squads, Tasks). The default is "children become roots; admin re-parents." Auto-promotion silently rewrites org structure and was rejected during design.
- **Reactive per-row "in-use-by" badges** in admin tables. Considered and rejected — the cost of querying the FK graph for every row on every render is high, and the information is most actionable at the moment of decision (the modal preview), not as ambient column data.
- **Big-bang migration of existing orphans** before launch. The validation strategy ("touched fields only" on update) makes a migration unnecessary for safe rollout. The on-demand scanner gives admins awareness; cleanup is opt-in and targeted.
- **Per-edge feature flags** or a global integrity feature flag. The codebase has no precedent for feature flags; the phased rollout (dead code → wiring → UI → tooling) provides safer rollback (`git revert <Phase 2>`) than a flag would.
- **End-to-end / Playwright coverage** of the delete modal flow. Layer correctness is verified at the engine surface; UI coverage is added opportunistically.
- **Owned-target cascade as a generic primitive.** Only `Members → ProfilePictures` exhibits this pattern; per the Rule of Three, this is special-cased in `members.delete` until a third instance appears.

## Further Notes

- **Composition with `MutationWithAudit`.** The integrity engine deliberately does not call `createLog` itself. It returns effects; the calling body returns `{ id, effects }`; the `runMutation` descriptor's `audit(args, result)` callback rolls effects into the standard audit payload. Single emission point preserves the existing audit pipeline's "audit lifecycle is owned by `runMutation`" invariant.
- **Composition with `CollectionPermissionRegistry`.** Foreign-key declarations live as a new field on existing `CollectionRegistryEntry` rather than a parallel registry. Future per-collection metadata concerns (validation rules, indexing hints) follow the same pattern. Per the Rule of Three: 13 collections × 21 edges ≫ 3.
- **Squad-scoped previews.** When the calling user has squad-scoped read on Members (per `getSquadScope`), preview `sample` arrays exclude entities outside the user's scope, but `count` remains the full count so admin decision-making isn't misled. This trades a small information-leak surface (the count itself) for honesty in the preview.
- **Idempotence as a load-bearing property.** Every integrity operation must be idempotent under retry: `$pull` on an already-pulled array is a no-op; `$set: null` on an already-null field is a no-op; `removeAsync` on a missing doc is a no-op. The engine relies on this for safe partial-retry. The `server/integrity.ts` file should carry a header comment noting this property so future maintainers don't accidentally violate it (e.g., by adding "decrement a counter" logic inline).
- **i18n of error codes.** Errors raised by the engine carry stable codes (`foreign_key_blocked`, `foreign_key_invalid`, `integrity_partial_failure`). Client-side rendering uses these codes as `LocaleSet` keys via `useTranslation()`, with the `details` payload supplying interpolation params (counts, source names, sample lists).
- **ADR.** This PRD introduces three architectural concepts (foreign-key registry as a CollectionRegistryEntry field, owned-target special-case, structured `Meteor.Error` `details` payloads). An ADR in `docs/adr/` is appropriate once Phase 1 lands so the doctrine is captured before downstream code starts depending on it.
