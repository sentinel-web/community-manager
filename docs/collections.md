# Collection Schemas

Field-level reference for every MongoDB collection. The source of truth is the
`*.collection.ts` files in `imports/api/collections/`; this doc is a quick map.
Per-collection permission/FK/audit metadata lives in `COLLECTION_REGISTRY`
(`server/collection-registry.ts`).

## Collections

Members (Meteor.users), Events, Attendances, Tasks, TaskStatus, Squads, Ranks, Specializations, Medals, EventTypes, Positions, Registrations, DiscoveryTypes, Roles, ProfilePictures, Settings, Logs, Questionnaires, QuestionnaireResponses, BriefingTemplates

## Schemas

**Members** (Meteor.users)
- `username`, `password`, `profile: { name, id (1000-9999), roleId, squadId, rankId, navyRankId, specializationIds[], medalIds[], profilePictureId, discordTag, discordId, steamProfileLink, description, entryDate, exitDate, staticAttendancePoints, staticInactivityPoints, hasCustomArmour }`

- `profile.discordId` is server-owned: set only by the Discord link flow (`/link`, or the admin "link by username" action), never by a member form. See [`discord.md`](discord.md).

**Events**
- `name, start, end, eventType, hosts[], attendees[], isPrivate, color, preset, description, discordEventId, discordMessageId` (`description` is rich text — sanitized HTML, see the Rich Text pattern in `CLAUDE.md`)

- `preset` is a link or an uploaded file (`file:<name>:::<data URL>`, max 512 KB) — parse it with `imports/api/events/preset.ts`. `discordEventId` / `discordMessageId` are server-owned (written by the Discord bot; rejected on `events.insert`/`.update`)

**BriefingTemplates**
- `name, color, content, description` — `content` is the rich-text briefing body (sanitized HTML) loaded into an event's `description` as a one-way snapshot; `description` is a short plain-text note. Rides on the `briefingTemplates` permission module. See `CONTEXT.md` → BriefingTemplate.

**Tasks**
- `name, status (taskStatusId), participants[], priority ('low'|'medium'|'high'), link, description, parent (taskId), createdAt`
- `createdAt` is server-owned: stamped on insert (any client-supplied value is overwritten) and stripped from updates.

**Squads**
- `name, color, image (base64), parentSquadId, shortRangeFrequency, longRangeFrequency, description, order`
- `order` (optional non-negative number) sorts squads — ORBAT siblings, the members squad view and the squads table — by `{ order, name }`, missing order last

**Ranks**
- `name, abbreviation, type ('player'|'zeus'), color, previousRankId, nextRankId, description`
- `abbreviation` (optional, max 16 chars, e.g. "OFw") is shown in compact places (rank tags, ORBAT, squad member lists) with the full name in a tooltip; selects show the full name. `previousRankId`/`nextRankId` form the seniority chain used to sort members by rank

**Specializations**
- `name, color, linkToFile, instructors[], requiredSpecializations[], requiredRankId, description`

**Medals, TaskStatus, DiscoveryTypes**
- `name, color, description` (DiscoveryTypes also `hasTextInput`)

**EventTypes**
- `name, color, description, countsForInactivity, createDiscordEvent` — `createDiscordEvent` mirrors events of this type to Discord; `countsForInactivity` (boolean, unset = `true`): when `false`, unexcused absences (`-1`) at events of this type add no inactivity points (the attendance-point penalty still applies)

**Roles**
- `name, color, description` + boolean permissions (`dashboard, orbat, logs, settings`) + CRUD permissions (`members, events, tasks, squads, ranks, specializations, medals, eventTypes, positions, taskStatus, registrations, discoveryTypes, roles, questionnaires`)

**Registrations**
- `name, id (1000-9999), age (min 16), discoveryType, rulesReadAndAccepted, description, createdAt`
- `createdAt` is server-owned: stamped on insert (any client-supplied value is overwritten) and stripped from updates. Registrations created before it was introduced have none.
- Insert is the only mutation open to anonymous callers (the public application form), so it takes only the fields listed above plus `discoveryTypeDetails, steamProfileLink, discordTag` — anything else is rejected, `_id` is always server-generated, and the method is rate limited per client address (`rateLimits.registrations.insert` in `server/config.ts`).

**Questionnaires**
- `name, description, status ('draft'|'active'|'closed'), allowAnonymous, interval ('once'|'daily'|'weekly'|'monthly'|'unlimited'), questions[], createdAt, updatedAt`
- `questions[]: { text, type ('text'|'textarea'|'number'|'select'|'multiselect'|'rating'), required, options[] }`

**QuestionnaireResponses**
- `questionnaireId, respondentId (null if anonymous), answers[], ignored, submittedAt, createdAt`
- `answers[]: { questionIndex, questionText, questionType, value }`

**Attendances** - `{ _id, eventId, [memberId]: status }` — one document per event (unique index on `eventId`), each member's status under a dynamic `[memberId]` key. Status is an int: `-2` event cancelled, `-1` absent (unexcused), `0` excused, `1` present, `2` present (Zeus). Points (`imports/api/attendance/points.ts`): `-1` → +1 inactivity point and −1 attendance point, `1`/`2` → +1 attendance point, `0`/`-2` → nothing; both start from the member's `static*Points`
**ProfilePictures** - `{ value (base64) }`
**Settings** - Key-value store. `discord-*` keys are written only through `discord.configure`; `discord-bot-token` is stored encrypted and never published

Ranks, Roles, Squads and Specializations each carry an optional `discordRoleId` (the mapped Discord role).
**Logs** - `{ action, data, createdAt }`
