# Collection Schemas

Field-level reference for every MongoDB collection. The source of truth is the
`*.collection.ts` files in `imports/api/collections/`; this doc is a quick map.
Per-collection permission/FK/audit metadata lives in `COLLECTION_REGISTRY`
(`server/collection-registry.ts`).

## Collections

Members (Meteor.users), Events, Attendances, Tasks, TaskStatus, Squads, Ranks, Specializations, Medals, EventTypes, Positions, Registrations, DiscoveryTypes, Roles, ProfilePictures, Settings, Logs, Questionnaires, QuestionnaireResponses, BriefingTemplates

## Schemas

**Members** (Meteor.users)
- `username`, `password`, `profile: { name, id (1000-9999), roleId, squadId, rankId, navyRankId, specializationIds[], medalIds[], profilePictureId, discordTag, steamProfileLink, description, entryDate, exitDate, staticAttendancePoints, staticInactivityPoints, hasCustomArmour }`

**Events**
- `name, start, end, eventType, hosts[], attendees[], isPrivate, color, preset, description` (`description` is rich text — sanitized HTML, see the Rich Text pattern in `CLAUDE.md`)

**BriefingTemplates**
- `name, color, content, description` — `content` is the rich-text briefing body (sanitized HTML) loaded into an event's `description` as a one-way snapshot; `description` is a short plain-text note. Rides on the `briefingTemplates` permission module. See `CONTEXT.md` → BriefingTemplate.

**Tasks**
- `name, status (taskStatusId), participants[], priority ('low'|'medium'|'high'), link, description, parent (taskId)`

**Squads**
- `name, color, image (base64), parentSquadId, shortRangeFrequency, longRangeFrequency, description`

**Ranks**
- `name, type ('player'|'zeus'), color, previousRankId, nextRankId, description`

**Specializations**
- `name, color, linkToFile, instructors[], requiredSpecializations[], requiredRankId, description`

**Medals, EventTypes, TaskStatus, DiscoveryTypes**
- `name, color, description`

**Roles**
- `name, color, description` + boolean permissions (`dashboard, orbat, logs, settings`) + CRUD permissions (`members, events, tasks, squads, ranks, specializations, medals, eventTypes, positions, taskStatus, registrations, discoveryTypes, roles, questionnaires`)

**Registrations**
- `name, id (1000-9999), age (min 16), discoveryType, rulesReadAndAccepted, description`

**Questionnaires**
- `name, description, status ('draft'|'active'|'closed'), allowAnonymous, interval ('once'|'daily'|'weekly'|'monthly'|'unlimited'), questions[], createdAt, updatedAt`
- `questions[]: { text, type ('text'|'textarea'|'number'|'select'|'multiselect'|'rating'), required, options[] }`

**QuestionnaireResponses**
- `questionnaireId, respondentId (null if anonymous), answers[], ignored, submittedAt, createdAt`
- `answers[]: { questionIndex, questionText, questionType, value }`

**Attendances** - `{ [eventId]: { [memberId]: points } }`
**ProfilePictures** - `{ value (base64) }`
**Settings** - Key-value store
**Logs** - `{ action, data, createdAt }`
