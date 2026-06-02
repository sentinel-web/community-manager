# Data Model & Collections

Every MongoDB collection in the app, its TypeScript document shape, and the
foreign-key graph that ties them together. This doc is relationship- and
mechanics-focused; the terse field-by-field cheat-sheet lives in
[`docs/collections.md`](../collections.md). Identifiers are English throughout;
user-facing strings are localized (i18n en/de/fr, default `en` — see
[`i18n.md`](./i18n.md)).

## Key files

- `imports/api/collections/*.collection.ts` — one `new Mongo.Collection<T>('name')` per collection; the `'name'` string argument is the wire/DB collection name.
- `imports/api/collections/members.collection.ts` — special case: re-exports `Meteor.users` cast to `Mongo.Collection<Member>` (members **are** users).
- `imports/api/types/` — shared interfaces mirroring each collection's document shape (`shared.ts`, `member.ts`, `event.ts`, `task.ts`, `squad.ts`, `rank.ts`, `role.ts`, `questionnaire.ts`, `misc.ts`); `crud.ts` defines `CrudCollectionMap` / `CrudCollectionName`.
- `server/collection-registry.ts` — `COLLECTION_REGISTRY`: per-collection `module`, `foreignKeys`, `displayField`, `redact`, `allowsAnonymous`, `aiContext`. **The FK source of truth.**
- `server/crud.lib.ts` — name→instance map + `getCollection()`; generates the CRUD methods/publications; holds the `HTML_FIELDS` and `INSERT_VALIDATORS` tables.
- `server/integrity/` — referential-integrity engine that inverts the FK edges and enforces `block`/`setNull`/`pull`/`cascade` on delete plus FK existence on write.
- `server/main.ts` — `createDatabaseIndexes()`, `ensureAttendancesUniqueIndex()`, `ensureLogRetentionIndex()` run at startup.
- `server/apis/attendances.server.ts` — the one custom write path for the special-shaped `attendances` collection (`attendances.upsert`).
- `server/apis/settings.server.ts` — owns the off-registry `settings` key-value store.

## Collection registration (coupled spots that must stay in sync)

Adding a CRUD collection touches **four** alphabetically-ordered spots; three are
compile-enforced, the registry is shape-enforced by `Record<CrudCollectionName,_>`:

| Spot | File | Role |
|------|------|------|
| `CrudCollectionMap` keys | `imports/api/types/crud.ts` | canonical name → doc-type map; `keyof` it is `CrudCollectionName` |
| name→instance map | `server/crud.lib.ts` | name → `Mongo.Collection` instance, consumed by `getCollection()` |
| `COLLECTION_REGISTRY` | `server/collection-registry.ts` | name → permission/FK/audit metadata (`Record<CrudCollectionName, _>`) |
| `createCollectionMethods` / `createCollectionPublish` calls | `server/crud.lib.ts` | register the DDP methods + publication |

A fifth, **non-enforced** spot is the demo-data seeder
(`server/apis/demoData.server.ts`) — a new collection must be wired into both
`wipeAllCollections()` and `insertDemoData()` or its data silently leaks across
regenerations (CLAUDE.md → Demo Data).

## Collections

20 collections total: 19 are registered CRUD collections (members of the
`CrudCollectionName` union); the 20th, **Settings**, is a key-value store owned by
`settings.server.ts` and is **not** in `COLLECTION_REGISTRY`.

| Collection | DB name | Permission module | Purpose / notable shape |
|-----------|---------|-------------------|--------------------------|
| Members | `users` (`Meteor.users`) | `members` | Personnel records. **Are** `Meteor.users`; all domain fields live under the nested `profile` sub-doc; `services` holds the password hash and is stripped on every client read. |
| Events | `events` | `events` | Operations/missions. `start`/`end` dates, optional `rrule` recurrence; `description` is **rich-text HTML** (sanitized on every write). |
| Attendances | `attendances` | `events` | **One document per `eventId`**, with each member's status under a dynamic `[memberId]` key. Status is an int **-2..2**, not a boolean. |
| Tasks | `tasks` | `tasks` | Kanban cards. Self-referential `parent`; embedded `comments[]` (`{ userId, text, createdAt }`); `priority: low\|medium\|high`. |
| TaskStatus | `taskStatus` | `taskStatus` | Kanban columns. Bare `ColoredEntity`. |
| Squads | `squads` | `squads` | Org units. Self-referential `parentSquadId` (drives the ORBAT tree); `excludeFromOrbat?` hides a node; radio frequencies + base64 `image`. |
| Ranks | `ranks` | `ranks` | Self-referential `previousRankId`/`nextRankId` (ordered chain); `type: player\|zeus`. |
| Specializations | `specializations` | `specializations` | Qualifications. `ColoredEntity` + `instructors[]`, self-ref `requiredSpecializations[]`, `requiredRankId`, `linkToFile`. |
| Medals | `medals` | `medals` | Awards. Bare `ColoredEntity`. |
| EventTypes | `eventTypes` | `eventTypes` | Reference. Bare `ColoredEntity`. |
| Positions | `positions` | `positions` | Reference. `ColoredEntity` + `order?`. |
| Registrations | `registrations` | `registrations` | Recruit applications. **Public-insertable** (`allowsAnonymous.insert`); insert validators enforce `id ∈ [1000,9999]`, `age ≥ 16`. |
| DiscoveryTypes | `discoveryTypes` | `discoveryTypes` | "How did you find us" options. **Public-readable** for the pre-auth registration form; `ColoredEntity` + `hasTextInput?`. |
| Roles | `roles` | `roles` | Permission grants: per-module `boolean` or `CrudPermission`, plus capability flags consumed as registry `fallback`s. |
| ProfilePictures | `profilePictures` | `members` | `{ value }` base64 blob split out of the member doc; cascade-deleted with its member (custom, not a registry edge). |
| Settings | `settings` | `settings` (own API) | `{ key, value }` key-value store. Off-registry; methods/publications in `settings.server.ts`. |
| Logs | `logs` | `logs` | Append-only audit trail (`{ action, payload?, timestamp?, createdAt }`); TTL-expired. |
| Questionnaires | `questionnaires` | `questionnaires` | Surveys. Embedded `questions[]`; `status: draft\|active\|closed`; `interval: once\|daily\|weekly\|monthly\|unlimited`. |
| QuestionnaireResponses | `questionnaireResponses` | `questionnaires` | Embedded `answers[]`; `respondentId` (nullable), `questionnaireId` (cascade target). |
| BriefingTemplates | `briefingTemplates` | `briefingTemplates` | Reusable briefing blocks. `ColoredEntity` + `content` (the second **rich-text HTML** field), copied into an event's `description` as a one-way snapshot. |

`ColoredEntity` (`imports/api/types/shared.ts`) is the shared base for reference
collections: `{ _id?, name, color?, description? }`. `Medal`, `EventType`, and
`TaskStatus` are exactly that; `DiscoveryType`, `Position`, `Specialization`, and
`BriefingTemplate` extend it.

### Members == Meteor.users

`MembersCollection` is `Meteor.users` cast to `Mongo.Collection<Member>`
(`members.collection.ts`). Domain data lives in the nested **`profile`**
sub-document (`MemberProfile`), every field of which is optional. Two notable
profile fields:

- `profile.id` — the in-app unit number (1000–9999 by convention), distinct from `_id` (the Meteor user id).
- `profile.rank` — a **legacy** free-text rank that may linger on documents predating the `profile.rankId` FK migration. Distinct from `profile.rankId`.

The top-level `services` block (bcrypt hash + reset tokens) is **stripped on every
client-reachable read** — publications project `{ fields: { services: 0 } }` and
custom fetches `delete member.services` post-fetch (`members.server.ts`).

## Foreign-key relationships

FK edges are authored **per source collection** in
`COLLECTION_REGISTRY[*].foreignKeys` as
`{ field, target, kind: 'scalar'|'array', onDelete: 'block'|'setNull'|'pull'|'cascade' }`.
`field` is a dotted path (e.g. `profile.rankId`). At boot the engine **inverts**
these into incoming edges keyed by target (`server/integrity/edges.ts`), so a
delete of a target can find every source pointing at it.

**Outgoing edges (who references whom) — 23 declared in the registry:**

| Source.field | → Target | Kind | onDelete |
|--------------|----------|------|----------|
| `events.eventType` | eventTypes | scalar | **block** |
| `events.hosts` | members | array | pull |
| `events.attendees` | members | array | pull |
| `members.profile.roleId` | roles | scalar | **block** |
| `members.profile.rankId` | ranks | scalar | **block** |
| `members.profile.navyRankId` | ranks | scalar | setNull |
| `members.profile.positionId` | positions | scalar | setNull |
| `members.profile.squadId` | squads | scalar | setNull |
| `members.profile.specializationIds` | specializations | array | pull |
| `members.profile.medalIds` | medals | array | pull |
| `questionnaireResponses.respondentId` | members | scalar | setNull |
| `questionnaireResponses.questionnaireId` | questionnaires | scalar | **cascade** |
| `ranks.previousRankId` | ranks (self) | scalar | setNull |
| `ranks.nextRankId` | ranks (self) | scalar | setNull |
| `registrations.discoveryType` | discoveryTypes | scalar | setNull |
| `specializations.instructors` | members | array | pull |
| `specializations.requiredSpecializations` | specializations (self) | array | pull |
| `specializations.requiredRankId` | ranks | scalar | setNull |
| `squads.parentSquadId` | squads (self) | scalar | setNull |
| `tasks.status` | taskStatus | scalar | **block** |
| `tasks.participants` | members | array | pull |
| `tasks.completedBy` | members | array | pull |
| `tasks.parent` | tasks (self) | scalar | setNull |

Plus **one FK enforced outside the registry**, in custom code:
`members.profile.profilePictureId` → `profilePictures` is cascade-deleted by
`members.remove` (`members.server.ts`), **not** declared as a registry edge.

**Entity-relationship overview** (→ = references; `[blk]` block, `[null]` setNull, `[pull]` array-pull, `[csc]` cascade; `↺` = self-reference):

```
                          ┌──────────┐
        eventTypes ◄[blk]─┤  events  ├─[pull]► members ◄───────────┐
                          └──────────┘            ▲                │
   taskStatus ◄[blk]──────┐                       │ (hosts,        │
                          │   ┌─────────┐         │  attendees)    │
   tasks (parent ↺[null])─┼──►│  tasks  ├─[pull]──┤ (participants, │
                          │   └─────────┘         │  completedBy)  │
                                                  │                │
   members.profile ─[blk]──► roles                │                │
        ├─[blk]──► ranks ◄──────────────┐         │                │
        ├─[null]─► ranks  (navyRankId)   │        │                │
        ├─[null]─► positions             │        │                │
        ├─[null]─► squads (parentSquadId ↺[null]) │                │
        ├─[pull]─► specializations ─[pull]─► members (instructors)─┘
        │              ├─[null]─► ranks ─┘        │
        │              └─[pull]─► specializations (self ↺)
        └─[pull]─► medals                         │
                                                  │
   questionnaireResponses ─[null]─► members ──────┘
        └─[csc]──► questionnaires   (delete questionnaire ⇒ delete its responses)

   registrations ─[null]─► discoveryTypes
   members (profilePictureId) ──cascade──► profilePictures   (custom, members.server.ts)
```

Collections with **no outgoing FK edges** (leaf reference data + ledgers):
eventTypes, discoveryTypes, positions, medals, roles, taskStatus, attendances,
logs, settings, profilePictures, questionnaires (incoming-only),
briefingTemplates.

### Write-time FK validation (`server/integrity/writeValidation.ts`)

Both the generic CRUD path and the custom `members.*` path validate FK
**existence** before any Mongo write (the *full document*, not just touched fields):

- **insert** — `validateForeignKeys()` walks every FK present on the payload (`extractWrittenFKs`).
- **update** — `validateForeignKeysForUpdate()` merges `{ $set: changes }` onto the stored doc (`applyModifierToDoc`) and validates *every* FK on the result, so an unrelated edit can't leave a now-orphaned FK in place. `applyModifierToDoc` supports `$set` **only** and throws on any other operator.

A missing target throws `Meteor.Error('foreign_key_invalid', …)`.

### Delete-time integrity (`server/integrity/traversal.ts`, `delete.ts`)

`enforceIntegrityOnDelete(target, id, ctx)` walks the inverted graph twice:

1. **preview pass** — collects all `block` violations (count + sample display names via `displayField`). If any, it throws `foreign_key_blocked` **before** mutating anything.
2. **execute pass** — applies `pull` (`$pull` id from array), `setNull` (`$set field = null`), and `cascade` (recursively delete referencing docs, firing *their* integrity rules first).

Every primitive is idempotent; execution is best-effort sequential with **no
transactions**, and a `visited` set breaks cascade cycles. See
[`referential-integrity.md`](./referential-integrity.md) for the full engine.

## Gotchas

- **Members are users.** Domain fields live under `profile.X`. Read them with a non-null assertion (`member.profile!.X`), never optional chaining — optional chaining masks crashes (CLAUDE.md → Common Gotchas). The `services` block must be stripped from any client-reachable read.
- **Attendance `status` is an int -2..2**, not a boolean (`-2` cancelled, `-1` absent, `0` excused, `1` present, `2` zeus), and the layout is one doc per event with dynamic member keys — never read-then-write; use `attendances.upsert` keyed on `eventId`.
- **`memberId` becomes a document key** in attendances, so it is validated against `/^[A-Za-z0-9]{17,24}$/` and rejected if it contains `.`/`$` or collides with `_id`/`eventId`.
- **`MemberProfile.rank` is a legacy field** (free-text) that may linger on old docs predating the `rankId` migration — distinct from `profile.rankId`.
- **Adding a collection touches four enforced spots** (type map, name→instance map, registry, method/publish calls) plus the **fifth, unenforced** demo-data seeder. Keep all alphabetical.
- **FK edges live only in the registry**, except `members → profilePictures` cascade which is hand-rolled in `members.server.ts`. Don't expect it in `foreignKeys`.
- **`onDelete: block` vs the rest.** Only `members.profile.roleId`, `members.profile.rankId`, `events.eventType`, and `tasks.status` block deletion of the referenced doc; everything else silently `setNull`/`pull`/`cascade`. A delete that "won't go through" is usually a block edge.
- **Update FK validation is full-document.** An edit to one field can be rejected because a *different*, untouched FK on the same doc is now orphaned — run the orphan migration (`server/integrity/orphans.ts`) first.
- **`applyModifierToDoc` only supports `$set`.** Custom array-operator updates (e.g. attendees `$pull`/`$addToSet`, task-comment `$push`) bypass it via direct `Collection.updateAsync` and are *not* full-doc FK-validated.
- **Settings is not a CRUD collection** — no registry entry, no FK edges, no generic CRUD methods; its permission module is the boolean `settings` flag and it lives in `settings.server.ts`. Two publications: `settings` (authenticated, full) and `settings.public` (unauthenticated, limited to `community-title`/`community-logo`/`community-color`).
- **Rich text is exactly two fields** — `events.description` and `briefingTemplates.content`. Every other `description` is plain text. See [`rich-text.md`](./rich-text.md) and [ADR-0001](../adr/0001-rich-text-descriptions-as-sanitized-html.md).
- **Nullable wire fields are `string | null`** (e.g. `Registration.discoveryType`) and must mirror that exactly — convert to `undefined` only at the antd DOM boundary, never on a server-write path.

## See also

- [`crud-engine.md`](./crud-engine.md) — `createCollectionMethods`/`createCollectionPublish`, `HTML_FIELDS`, `INSERT_VALIDATORS`.
- [`permissions-rbac.md`](./permissions-rbac.md) — how `module`/`fallback`/`CrudPermission` from `Role` + registry are evaluated.
- [`referential-integrity.md`](./referential-integrity.md) — deep dive on the FK engine summarized here.
- [`server-apis.md`](./server-apis.md) — custom server methods/publications (`attendances`, `members`, `settings`, …).
- [`../collections.md`](../collections.md) — terse field-by-field cheat-sheet (companion to this relationship-focused doc).
- `../../CONTEXT.md` — domain glossary and decisions.
- `../../CLAUDE.md` → "Adding New Collections", "Common Gotchas", "Permission System", "Demo Data".
