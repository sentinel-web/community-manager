# UI Feature Modules

The hand-rolled feature views in `imports/ui/<feature>/` that go **beyond** the
generic `<Section<T>>` CRUD table — calendars, Kanban boards, org charts, the
command palette, the guided tour, dashboards, the public registration flow, and
the questionnaire response/briefing-template surfaces. Each leans on a specific
third-party library; this doc maps the components, their data flow, and the
library each rides on. For the exhaustive per-surface index (every drawer form /
viewer / widget) see [`docs/views-and-forms.md`](../views-and-forms.md); for the
server methods these call see [`server-apis.md`](./server-apis.md).

## Key files

| Feature | Entry | Hand-rolled view(s) | Library |
|---------|-------|---------------------|---------|
| Events | `events/Events.tsx` | `EventCalendar`, `EventAttendance`, `EventDetailPopover`, `EventForm` | `react-big-calendar` + `dayjs` + `rrule` |
| Tasks | `tasks/Tasks.tsx` | `KanbanBoard`, `TaskForm`, `TaskFilter` | `react-beautiful-dnd` |
| ORBAT | `orbat/Orbat.tsx` | `Orbat` (single file, nested label components) | `react-organizational-chart` |
| Palette | `palette/Palette.tsx` | `Palette`, `PaletteContext`, `palette.*` helpers | `fuse.js` |
| Registration | `registration/Registration.tsx` | `RegistrationForm`, `RegistrationExtra` | (antd only) |
| Dashboard | `dashboard/Dashboard.tsx` | `Dashboard`, `ProfileStats` | (antd only) |
| Questionnaires | `questionnaires/Questionnaires.tsx`, `MyQuestionnaires.tsx` | `QuestionnaireForm`, `QuestionnaireResponseForm`, `QuestionnaireResponses`, `ResponseDetailView` | (antd only) |
| Tour | `tour/DemoTour.tsx` | `DemoTour`, `TourContext`, `tourSteps.ts` | antd `Tour` |
| Briefing templates | `briefing-templates/BriefingTemplates.tsx` | `BriefingTemplatesForm` | `RichTextEditor` (Tiptap) |

Routing for all of these is the pathname-based `navigationValue` switch in
`imports/ui/main/Main.tsx` — each view is `lazy()`-loaded and gated by
`checkAccess(role, navigationValue)`. There is no router library.

## How it works

### Section vs. custom view

Most feature entries still mount `<Section<T>>` and only supply a `customView`
that replaces the table body. `Section` owns the search box, create/edit/delete
drawer plumbing, and the `?action=create` deep-link (`Section.tsx:151-160`);
the custom view receives the filtered `datasource` plus `handleEdit`/`handleDelete`.

| Feature | Pattern |
|---------|---------|
| Events | `Section` + `customView` switched by a local `viewType` (`calendar` / `attendance` / `table`); `table` falls through to the default `Section` table (`customView = false`) |
| Tasks | `Section` + `customView = KanbanBoard` **only** when the persisted `profile.taskFilter.type === 'kanban'`, else default table |
| Registration / Briefing templates | plain `Section`, no custom view (listed here for the **forms**, which are rich/anonymous) |
| Questionnaires | plain `Section`, but the columns factory injects a "view responses" action that pushes `QuestionnaireResponses` onto the DrawerStack |
| ORBAT / Dashboard / MyQuestionnaires | fully hand-rolled, no `Section` at all — they fetch via methods and render cards/charts directly |

### Events (`react-big-calendar` + `rrule`)

`Events.tsx` is the shell: a `viewType` selector (`calendar`/`attendance`/`table`),
an event-type multi-select filter, a date-range picker (shown only for table &
attendance), and a "relevant to me" checkbox that ORs `hosts`/`attendees` against
the current `userId` into the Mongo selector (`filterFactory`, `Events.tsx:44`).

- **`EventCalendar`** wraps `react-big-calendar` with its drag-and-drop addon
  (`withDragAndDrop(Calendar)`, `EventCalendar.tsx:21`). The localizer is
  `dayjsLocalizer(dayjs)`, re-created when the i18n `language` changes
  (`EventCalendar.tsx:34-40`). Below `BREAKPOINTS.MOBILE` it defaults to the
  `agenda` list (the month grid is unreadable on a phone). `onRangeChange`
  (`EventCalendar.tsx:123`) recomputes the visible window and pushes a
  `{ start: {$lte}, end: {$gte} }` overlap filter up to the parent's `setFilter`,
  so the subscription only loads visible events. Drag/resize/slot-select all
  funnel into `openForm` which pushes `EventForm` onto the DrawerStack with the
  dragged dates pre-filled — **the drag does not persist directly**, it opens the
  form. `eventPropGetter` colours each block by `event.color` (falling back to its
  event-type colour) and picks legible text via `getLegibleTextColor`.
- **Recurrence (`rrule`)** is handled server-side / in the data layer, not in
  these components — the calendar renders whatever expanded `EventDoc[]` the
  subscription yields (see `data-model.md` → Events, `rrule` for recurrence).
- **`EventDetailPopover`** is a `Modal` (not a real popover) opened on
  `onSelectEvent`. It lazily calls `events.detail` for the enriched single event
  (resolved host/attendee names, type colour, `isSignedUp`) and exposes an
  **RSVP** button calling `events.rsvp`, which toggles the caller in/out of
  `attendees` and returns the new boolean state.
- **`EventAttendance`** renders a grid: members down the rows, events across the
  columns, one editable status `Select` per cell. Status values are the canonical
  `-2 | -1 | 0 | 1 | 2` set (cancelled / absent / excused / present / present-as-Zeus
  — see [attendance value mapping] in memory). A cell write calls
  `attendances.upsert(eventId, memberId, status)` — an **atomic per-event upsert
  keyed on `{ eventId }`**, race-safe after #261; the old read-then-write created
  duplicate rows. The leftmost columns derive running **inactivity points** (+1
  per absence) and **attendance points** (per-status sum) from the member's
  `static*Points` baseline plus the attendance docs (`EventAttendance.tsx:230-252`).
  Member names are pre-computed into a `Map` to avoid N+1 lookups per row.

| Attendance status | Value | Tag colour | Points effect |
|-------------------|-------|-----------|---------------|
| Event cancelled | `-2` | default | skipped (neither IP nor points) |
| Absent | `-1` | red | `+1` inactivity point |
| Excused | `0` | yellow | `+0` |
| Present | `1` | green | `+1` |
| Present (Zeus) | `2` | cyan | `+1` |

- **`EventForm`** is a rich form: `MembersSelect` for hosts/attendees, a
  `SquadQuickAdd` widget (bulk-adds a whole squad or all members via
  `members.read` with `{ fields: { _id: 1 } }`), and a `BriefingTemplatePicker`
  that copies a template's `content` into the `description` as a **one-way
  snapshot** (no link kept; confirms overwrite via `shouldConfirmTemplateOverwrite`).
  `description` is the rich-text field, edited through `RichTextEditor`.

### Tasks (`react-beautiful-dnd`)

`Tasks.tsx` reads the persisted filter from `Meteor.user().profile.taskFilter`
(a server-side preference, edited via the `TaskFilter` drawer which calls
`members.saveTaskFilter`). The filter's `type` (`table`/`kanban`) selects the
view; `status` and `participants` arrays feed the Mongo selector.

- **`KanbanBoard`** builds one column per task-status. With no status filter it
  shows **every** `TaskStatus` as a column (so an empty filter is not an empty
  board, `KanbanBoard.tsx:34-38`). Columns are responsive: `colSpan` is the max of
  a breakpoint minimum and `24 / columnCount`.
- **DnD**: `<DragDropContext onDragEnd>` wraps `<Droppable droppableId={statusId}>`
  columns of `<Draggable draggableId={task._id}>` cards. On drop, `onDragEnd`
  reads `destination.droppableId` (the target status) and fires
  `tasks.update(draggableId, { status })` directly — **this is the one place a
  drag persists immediately** (contrast the calendar, which opens a form). A drop
  back into the same slot is a no-op.
- Cards show description (truncated), participant + completed-by avatars
  (`Participants` from `task.columns`), created date, and a comment-count badge.
- **`TaskForm`** additionally hosts an inline comments thread (existing tasks
  only): `tasks.addComment(taskId, text)` appends, with optimistic local state.
  `parent` is a self-referential `CollectionSelect` (subtasks).

### ORBAT (`react-organizational-chart`)

`Orbat.tsx` is a single file. It fetches the squad tree via `orbat.squads`, then
client-side partitions squads into **roots / parents / children** and assembles a
nested `OrbatNode` tree (`getOptions`, `Orbat.tsx:57-108`). The ordered traversal
(roots → parents → children) guarantees a parent is placed before any child looks
it up via `findParentRecursive`; a `Set` of referenced parent IDs turns the
"is anyone my child?" check from O(n²) to O(n). Squad images (base64) are decoded
in parallel before the sequential tree assembly.

- Renders with `<Tree>` / `<TreeNode>` from `react-organizational-chart`;
  `lineColor` follows the theme. The card scrolls horizontally only (a wide tree
  pans sideways rather than pushing a page scrollbar).
- Two label modes via a `viewType` selector: **`simple`** (`ORBAT_SimpleLabel`,
  image + name + SR-frequency, click-popover roster) and **`advanced`**
  (`ORBAT_AdvancedLabel`, a coloured inner card listing members inline). Both pull
  the per-squad roster lazily via `orbat.popover.items(squadId)`.
- Note: `descritpion` (sic) and `ORBAT_*` PascalCase-with-underscore names are
  the actual identifiers in the source.

### Palette (`fuse.js`)

The Cmd+K (or Ctrl+K) command palette. The keybind and open state live in
`PaletteContext` (`PaletteProvider`, `PaletteContext.tsx:20-29`); `Palette.tsx`
is the modal.

Item kinds and sources (all typed `PaletteItem` in `palette.types.ts`):

| Kind | Source factory (`palette.items.ts`) | Gating | Action |
|------|--------------------------------------|--------|--------|
| `navigate` | `getNavigatePaletteItems` (`NAV_ROUTES`) | `hasAccess(role, module)` | client navigate to route |
| `action` (create) | `getCreatePaletteItems` (`CREATE_ACTIONS`) | `hasCreateAccess` (admin / module `create`) | navigate to route with `?action=create` (Section auto-opens the create drawer) |
| `action` (global) | `getGlobalPaletteItems` | always | switch language / toggle theme / logout |
| `entity` | `getEntityPaletteItems` | server-filtered | navigate to the entity's collection view |

- **Search**: typing debounces 150 ms then calls `palette.search(query)`
  (`Palette.tsx:167-186`), which returns permission-filtered, squad-scoped matches
  across members/events/tasks/squads/registrations/questionnaires. Static items
  (navigate/create/global) plus those entity results are ranked client-side by
  `scoreItems` (`palette.scoring.ts`) — a `fuse.js` fuzzy search over the `label`
  field (threshold `0.4`, location-ignored), with a **prefix-match boost** and a
  **recency boost**.
- **Recents / frecency** (`palette.recents.ts`): selections are stored in
  `localStorage` (`cm.palette.recents`, max 10, stale after 30 days). The score is
  `log10(count + 1) * exp(-age / 14d-half-life)` (`frecencyScore`). With an empty
  query the list is `recents → create → global → navigate`, each group
  recency-sorted; recents older than the half-life decay out.
- **a11y**: a `combobox`/`listbox`/`option` ARIA structure with arrow-key
  navigation, `aria-activedescendant`, and a debounced live-region result count.

### Registration (public / anonymous flow)

Registration has two entry points and is the main **anonymous** surface:

1. **Public** — the login screen (`Login.tsx`) "Register" button pushes
   `RegistrationForm` onto the DrawerStack for a logged-**out** visitor. The form
   inserts a `registrations` doc; the collection's registry entry sets
   `allowsAnonymous: { insert: true }` and `discoveryTypes` sets
   `allowsAnonymous: { read: true }` so the unauthenticated insert + the discovery
   dropdown both succeed (`server/collection-registry.ts:49,99`).
2. **Admin** — the `registrations` Section (managers triage applications).

- **`RegistrationForm`** live-validates desired **name** and **id** against
  `registrations.validateName` / `registrations.validateId` (cross-checking both
  members and registrations) as independent signals — folding them into one state
  let a valid id mask an in-use name (`RegistrationForm.tsx:52-60`). `id` is a
  1000–9999 number, age ≥ 16, rules-accepted is enforced by a field validator
  **and** re-checked in `handleSubmit` so Enter-to-submit can't bypass it. The
  `description` field only renders for logged-in (admin) users. Insert-vs-update
  plumbing (anonymous always inserts) lives in `useEntityForm`.
- **`RegistrationExtra`** is the admin "promote to member" action shown per row:
  it checks whether a member already references this `registrationId` (via
  `members.findOne`) to disable the button, then a modal collects username/password
  and calls `members.insert` with the registration's profile fields copied across
  plus `profile.registrationId` back-link.

### Dashboard (`ProfileStats` + at-a-glance stats)

`Dashboard.tsx` calls the role-gated `dashboard.stats` aggregation once on mount
(refreshable). The payload has a `profile` block plus arbitrary count/group-by
keys. The view renders two `Collapse` panels:

- **Your profile** — `ProfileStats` (exported, also reused elsewhere) lays the
  profile out as antd `Descriptions`: a circular avatar, one-third-width fields
  (rank/id/name/entry-date/squad/role/points), and full-width
  description/specializations/medals. Specializations render as clickable `Tag`s
  linking to `linkToFile`.
- **Collection stats** — every non-`profile` key becomes a `Statistic` card;
  object values (group-by results) fan out into one card per child key.
- Server-data keys are mapped to localized labels via the closed
  `STATS_LABEL_KEYS` / `PROFILE_LABEL_KEYS` maps (`as const satisfies Record<...,
  LocaleKey>`), falling back to the raw key string when unmapped.

### Questionnaires & responses (anonymous responses)

Three surfaces, split by audience:

| Surface | File | Audience | Server method(s) |
|---------|------|----------|------------------|
| Authoring | `Questionnaires.tsx` → `QuestionnaireForm` | managers | CRUD (`questionnaires.*`) |
| Responses review | `QuestionnaireResponses` → `ResponseDetailView` | managers | `questionnaireResponses.getForQuestionnaire`, `setIgnored` |
| Fill-out ("My questionnaires") | `MyQuestionnaires.tsx` → `QuestionnaireResponseForm` | members | `questionnaires.getActiveForUser`, `questionnaireResponses.submit`, `revoke` |

- **`QuestionnaireForm`** uses an antd `Form.List` for a dynamic question array.
  Each question has a `type` (`text` / `textarea` / `number` / `select` /
  `multiselect` / `rating`) — `select`/`multiselect` reveal an options
  (`mode="tags"`) field via `Form.useWatch`. Flags: `status`
  (`draft`/`active`/`closed`), `allowAnonymous`, and a response `interval`
  (`once` / `daily` / `weekly` / `monthly` / `unlimited`).
- **`MyQuestionnaires`** is card-based (not a Section). `questionnaires.getActiveForUser`
  returns each active questionnaire enriched with the caller's eligibility
  (`canRespond`, `responseReason`, `nextAllowedDate`, `latestResponseId`). The card
  action is **fill-out** (pushes `QuestionnaireResponseForm`), **completed**
  (interval `once`), or a **wait** notice — and a **revoke** button when a
  non-anonymous response exists and the interval window has not reopened.
- **`QuestionnaireResponseForm`** maps each question type to its antd widget and
  resolves the drawer frame with the sentinel `true` on submit (so the opener can
  tell "submitted" from "cancelled" and refresh). Answers are keyed by
  `question_<index>`. When `allowAnonymous`, the stored response has
  `respondentId: null` (server-side, `questionnaireResponses.submit`).
- **`QuestionnaireResponses`** loads paginated rows via method (not a
  subscription) with a load-more `limit`, gates the ignore/un-ignore action on the
  caller's `questionnaires.update` permission, and opens `ResponseDetailView`
  (read-only frame) per row. Anonymous responses display an "anonymous" tag instead
  of a respondent name.

### Tour (`antd` Tour + `TourContext`)

The first-run guided tour. Decoupled via two ref-maps in `TourContext`:

- **`useTourRef(key)`** registers a DOM ref under `key` so a step can target a
  component living anywhere in the tree (every feature view calls it, e.g.
  `useTourRef('events-calendar')`).
- **`useTourAction(key, fn)`** registers an imperative action (only Events uses
  it, to switch its internal `viewType` for the calendar/attendance steps).
- **`tourSteps.ts`** is the ordered step list: each step has a `page` (drives
  navigation), a `target` (reads `refs.current[refKey]`), and optional
  `action`/`cleanup` callbacks. `DemoTour` drives antd's `<Tour>`: on step change
  it runs the previous step's cleanup, navigates if needed, runs the action, then
  **polls for a size-stable target element** (`pollForStableElement`, 3 s timeout)
  before showing the step — this is what lets the tour reliably anchor to
  lazily-mounted / animating views. A `transitioning` ref guards against
  overlapping transitions.

### Briefing templates (rich text)

`BriefingTemplatesForm` is a plain `useEntityForm` over the `briefingTemplates`
collection. Its `content` field is rich text via `RichTextEditor` (Tiptap). The
initial value is supplied **synchronously through `initialValues`**, never a
deferred `setFieldsValue` effect — the editor seeds its document from `value` on
first render, so a deferred effect would race the editor lifecycle and lose
content (`BriefingTemplatesForm.tsx:28-39`). Templates are consumed by
`EventForm`'s `BriefingTemplatePicker` as a one-way snapshot into an event
`description` — there is no live link back to the template (see CONTEXT.md →
BriefingTemplate).

## Gotchas

- **Calendar drag ≠ persist.** Dragging/resizing an event opens `EventForm`
  pre-filled; it does **not** write. Only the Kanban drop (`tasks.update`) and the
  attendance-cell change (`attendances.upsert`) persist directly.
- **`useSubscribe` before `useFind`.** Every reactive view subscribes first; a
  missing subscription silently yields empty data (CLAUDE.md → Common Gotchas).
- **Attendance status `-2` is "cancelled", not "very absent".** It is *skipped*
  in both point sums; only `-1` adds an inactivity point.
- **Kanban with no status filter shows all statuses**, not an empty board — the
  filter array falling back to all `TaskStatus._id`s is deliberate.
- **Registration validity is two independent signals.** Don't collapse
  name/id availability into one state; the async validations clobber each other
  last-writer-wins. Rules-accepted must be re-guarded in `handleSubmit` because
  Enter-to-submit bypasses the disabled button.
- **Briefing-template / rich-text content must seed via `initialValues`**, not
  `setFieldsValue` — the Tiptap editor only reads `value` on first render.
- **`?action=create` is consumed once.** `Section` opens the create drawer then
  `replaceState`s the param away; the palette's create items rely on this, so the
  target route must be a `Section` with `canCreate` + a `FormComponent`.
- **Anonymous surfaces are registry-driven.** Public registration only works
  because `registrations` (`insert`) and `discoveryTypes` (`read`) set
  `allowsAnonymous`; anonymous questionnaire responses only when the questionnaire
  has `allowAnonymous: true` (which nulls `respondentId` server-side).
- **Tour targets must be size-stable.** `DemoTour` polls before anchoring; a step
  whose `target` never stabilises within 3 s falls back to the last known element
  (or `null`) and the step may render unanchored.
- **ORBAT typos are load-bearing.** `descritpion` and `ORBAT_*` are the real
  identifiers — don't "fix" them without updating every reference.

## See also

- [`docs/views-and-forms.md`](../views-and-forms.md) — exhaustive index of every
  navigable view, drawer form, drawer viewer, and embedded widget.
- [`server-apis.md`](./server-apis.md) — the custom methods these views call
  (`events.rsvp`/`detail`, `attendances.upsert`, `orbat.*`, `palette.search`,
  `dashboard.stats`, `questionnaires.*`, `registrations.validate*`, `tasks.addComment`).
- [`crud-engine.md`](./crud-engine.md) — the generic `<Section<T>>`/CRUD path the
  custom views layer onto; rich-text `HTML_FIELDS` sanitize-on-write.
- [`ui-architecture.md`](./ui-architecture.md) — the chrome these views mount
  into (Main routing switch, contexts/providers, DrawerStack, Section shell).
- [`rich-text.md`](./rich-text.md) — the `RichTextEditor`/`RichTextView` surfaces
  used by `EventForm` and `BriefingTemplatesForm`.
- [`data-model.md`](./data-model.md) — collection shapes (Events `rrule`/rich-text,
  BriefingTemplate `content`, Attendances grid).
- [`permissions-rbac.md`](./permissions-rbac.md) — `checkAccess`/`hasAccess`,
  module gating, anonymous (`allowsAnonymous`) reads/inserts.
- CONTEXT.md → **DrawerStack** (`push`/`useDrawerFrame`), **EntityForm**
  (`useEntityForm` create-vs-update), **MethodCall** (`useMethod`),
  **BriefingTemplate** (rich-text snapshot doctrine).
- [ADR-0001](../adr/0001-rich-text-descriptions-as-sanitized-html.md) — rich-text
  as sanitized HTML (events `description`, briefing-template `content`).
- CLAUDE.md → *Drawer Pattern*, *Common Gotchas*, *Key Dependencies*.
