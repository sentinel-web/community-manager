# Views & Forms

Index of every UI surface in `imports/ui/`. The source of truth is the `.tsx`
files themselves; this doc is a quick map of what renders where, how it is
mounted, and which permission module gates it.

There are three kinds of surface:

- **Navigable views** — top-level destinations mounted by the `navigationValue`
  switch in `imports/ui/main/Main.tsx`. Routing is pathname-based (no router
  library); each view is `lazy()`-loaded and gated by `checkAccess`. CRUD views
  delegate to the generic `<Section<T>>`; the rest hand-roll their layout.
- **Drawer frames** — components pushed onto the DrawerStack via
  `push<R, M>(...)` (see `CLAUDE.md` → Drawer Pattern). Two flavours: **editors**
  (`useDrawerFrame<string, Partial<T>>`, with `resolve`/`cancel`) and read-only
  **viewers** (`useDrawerFrame<void, M>`, model only).
- **Embedded widgets** — `Select` / `Tag` / `columns` helpers and charts that
  feed the views above but never mount standalone.

---

## Navigable views

Mounted in `imports/ui/main/Main.tsx`. "Nav key" is the `navigationValue` /
pathname segment; "Module" is the permission module (`MODULE_PERMISSION_MAP` in
`Main.tsx` remaps `backup`→`settings` and `myQuestionnaires`→`questionnaires`).

| Nav key | Component | Module | Kind | Renders |
|---------|-----------|--------|------|---------|
| `dashboard` | `dashboard/Dashboard.tsx` | dashboard | custom | Personal `ProfileStats`, attendance charts, at-a-glance widgets |
| `orbat` | `orbat/Orbat.tsx` | orbat | custom | Org chart (`react-organizational-chart`) with view selector |
| `events` | `events/Events.tsx` | events | Section + tabs | Switches between `EventCalendar` and `EventAttendance`; CRUD via `EventForm` |
| `eventTypes` | `events/event-types/EventTypes.tsx` | eventTypes | Section | `Section<EventType>` + `EventTypesForm` |
| `briefingTemplates` | `briefing-templates/BriefingTemplates.tsx` | briefingTemplates | Section | `Section<BriefingTemplate>` + `BriefingTemplatesForm` (rich text) |
| `tasks` | `tasks/Tasks.tsx` | tasks | Section + Kanban | `Section<Task>` rendering `KanbanBoard`; CRUD via `TaskForm`, filter via `TaskFilter` |
| `taskStatus` | `tasks/task-status/TaskStatuses.tsx` | taskStatus | Section | `Section<TaskStatus>` + `TaskStatusForm` |
| `squads` | `squads/Squads.tsx` | squads | Section | `Section<Squad>` + `SquadsForm`; row expand → `SquadMembers` |
| `members` | `members/Members.tsx` | members | Section | `Section<Member>` + `MemberForm`; squad-grouped via `MembersSquadView` |
| `ranks` | `members/ranks/Ranks.tsx` | ranks | Section | `Section<Rank>` + `RanksForm` |
| `specializations` | `specializations/Specializations.tsx` | specializations | Section | `Section<Specialization>` + `SpecializationForm` |
| `medals` | `members/medals/Medals.tsx` | medals | Section | `Section<Medal>` + `MedalsForm` |
| `positions` | `members/positions/Positions.tsx` | positions | Section | `Section<Position>` + `PositionsForm` |
| `registrations` | `registration/Registration.tsx` | registrations | Section | `Section<RegistrationDoc>` + `RegistrationForm`; row expand → `RegistrationExtra` |
| `discoveryTypes` | `registration/discovery-types/DiscoveryTypes.tsx` | discoveryTypes | Section | `Section<DiscoveryType>` + `DiscoveryTypesForm` |
| `roles` | `members/roles/Roles.tsx` | roles | Section | `Section<Role>` + `RolesForm` (permission matrix) |
| `questionnaires` | `questionnaires/Questionnaires.tsx` | questionnaires | Section | `Section<Questionnaire>` + `QuestionnaireForm`; responses via `QuestionnaireResponses` |
| `myQuestionnaires` | `questionnaires/MyQuestionnaires.tsx` | questionnaires | custom | Card list of questionnaires assigned to the current user; fill via `QuestionnaireResponseForm` |
| `logs` | `logs/Logs.tsx` | logs | custom table | Hand-rolled `Table<LogEntry>` (not `Section`); view via `LogViewer` |
| `settings` | `settings/Settings.tsx` | settings | custom | App settings panels incl. `DemoDataSettings` (dev-only demo seed) |
| `backup` | `backup/Backup.tsx` | settings | custom | Backup/restore (`jszip`); mapped to `settings` module |

---

## Drawer editors (forms)

Entity create/edit forms pushed onto the DrawerStack. Each resolves its nearest
frame via `useDrawerFrame<R, M>()` and returns the saved doc through `resolve`
(or `undefined` on `cancel`). The `R`/`M` column is the drawer-frame signature
(`R` = resolve type, `M` = model type).

| Form | File | `useDrawerFrame<R, M>` | Opened from |
|------|------|------------------------|-------------|
| `MemberForm` | `members/MemberForm.tsx` | `<string, Partial<Member>>` | Members section |
| `EventForm` | `events/EventForm.tsx` | `<string, Partial<EventDoc>>` | Events section/calendar (rich-text description) |
| `EventTypesForm` | `events/event-types/EventTypesForm.tsx` | `<string, Partial<EventType>>` | EventTypes section, `CollectionSelect` |
| `BriefingTemplatesForm` | `briefing-templates/BriefingTemplatesForm.tsx` | `<string, Partial<BriefingTemplate>>` | BriefingTemplates section (rich-text content) |
| `TaskForm` | `tasks/TaskForm.tsx` | `<string, Partial<Task>>` | Tasks / Kanban |
| `TaskStatusForm` | `tasks/task-status/TaskStatusForm.tsx` | `<string, Partial<TaskStatus>>` | TaskStatuses section, `CollectionSelect` |
| `SquadsForm` | `squads/SquadsForm.tsx` | `<string, Partial<Squad> & { _id? }>` | Squads section, `SquadsSelect` |
| `RanksForm` | `members/ranks/RanksForm.tsx` | `<string, Partial<Rank> & { _id? }>` | Ranks section, member rank pickers |
| `SpecializationForm` | `specializations/SpecializationForm.tsx` | `<string, Partial<Specialization> & { _id? }>` | Specializations section, `SpecializationsSelect` |
| `MedalsForm` | `members/medals/MedalsForm.tsx` | `<string, Partial<Medal> & { _id? }>` | Medals section, `MedalsSelect` |
| `PositionsForm` | `members/positions/PositionsForm.tsx` | `<string, Partial<Position> & { _id? }>` | Positions section, `PositionsSelect` |
| `RolesForm` | `members/roles/RolesForm.tsx` | `<string, Partial<Role> & { _id? }>` | Roles section (permission matrix) |
| `RegistrationForm` | `registration/RegistrationForm.tsx` | `<string, Partial<Registration>>` | **Public sign-up (`Login.tsx`)** + Registrations section |
| `DiscoveryTypesForm` | `registration/discovery-types/DiscoveryTypesForm.tsx` | `<string, Partial<DiscoveryType> & { _id? }>` | DiscoveryTypes section, `CollectionSelect` |
| `QuestionnaireForm` | `questionnaires/QuestionnaireForm.tsx` | `<string, Partial<Questionnaire>>` | Questionnaires section (question builder) |
| `QuestionnaireResponseForm` | `questionnaires/QuestionnaireResponseForm.tsx` | `<true, Questionnaire>` | MyQuestionnaires (respondent fills answers) |

`TaskFilter` (`tasks/TaskFilter.tsx`, `useDrawerFrame<void, TaskFilterModel | undefined>`)
is a drawer with `resolve`/`cancel` but filters rather than persists an entity.

---

## Drawer viewers (read-only frames)

Pushed onto the DrawerStack as model-only frames (no `resolve`/`cancel`).

| Viewer | File | `useDrawerFrame<void, M>` | Purpose |
|--------|------|---------------------------|---------|
| `LogViewer` | `logs/LogViewer.tsx` | `<void, LogEntry>` | Renders one audit-log entry; embeds `LogDiffView` |
| `QuestionnaireResponses` | `questionnaires/QuestionnaireResponses.tsx` | `<void, Questionnaire>` | Lists responses for a questionnaire; drill into `ResponseDetailView` |
| `ResponseDetailView` | `questionnaires/ResponseDetailView.tsx` | `<void, ResponseDetailModel>` | One respondent's answers |

---

## Embedded views & widgets

Components that render inside a view but never mount standalone.

**Member / profile**
- `members/MemberProfile.tsx` — full member profile (`memberId` prop)
- `members/ProfileModal.tsx` — current-user profile modal (header avatar)
- `members/MembersSquadView.tsx` — squad-grouped member layout for the Members section
- `members/AttendancePieChart.tsx` — attendance breakdown chart
- `members/MembersSelect.tsx` — member multi-select (+ `GroupedMembersSelect`)
- `dashboard/Dashboard.tsx#ProfileStats` — exported stats sub-component

**Events**
- `events/EventCalendar.tsx` — `react-big-calendar` + `rrule` recurring calendar
- `events/EventAttendance.tsx` — attendance grid/marking
- `events/EventDetailPopover.tsx` — hover/click event detail with edit hook

**Tasks**
- `tasks/KanbanBoard.tsx` — `react-beautiful-dnd` board rendered by the Tasks section

**Squads / orbat**
- `squads/SquadMembers.tsx` — members within a squad (row expand)
- `orbat/Orbat.tsx` — view selector + labelled org-chart nodes

**Registration**
- `registration/RegistrationExtra.tsx` — registration row-expand detail + confirm modal

**Logs**
- `logs/LogDiffView.tsx` — before/after diff of a log payload
- `logs/LogTableActions.tsx` — per-row view/delete actions

**Selects & tags** (inline create/edit via `CollectionSelect` where applicable)
- `squads/SquadsSelect.tsx`, `members/ranks/RanksSelect.tsx`,
  `members/medals/MedalsSelect.tsx`, `members/positions/PositionsSelect.tsx`,
  `specializations/SpecializationsSelect.tsx`
- `members/ranks/RankTag.tsx`, `members/positions/PositionTag.tsx`,
  `tasks/task-status/TaskStatusTag.tsx`,
  `registration/discovery-types/DiscoveryTypeTag.tsx`

**Column factories** (`ColumnsFactory<T>` feeding `<Section<T>>` / `Table`)
- `members/members.columns.tsx`, `events/event.columns.tsx`,
  `events/event-types/eventTypes.columns.tsx`, `tasks/task.columns.tsx`,
  `tasks/task-status/task-status.columns.tsx`, `squads/squads.columns.tsx`,
  `members/ranks/ranks.columns.tsx`, `members/medals/medals.columns.tsx`,
  `members/positions/positions.columns.tsx`,
  `specializations/specializations.columns.tsx`,
  `members/roles/roles.columns.tsx`, `registration/registration.columns.tsx`,
  `registration/discovery-types/discoveryTypes.columns.tsx`,
  `questionnaires/questionnaire.columns.tsx`,
  `questionnaires/questionnaireResponse.columns.tsx`,
  `briefing-templates/briefingTemplates.columns.tsx`, `logs/logs.columns.tsx`

**Shared chrome & infra** (not feature views)
- `app/App.tsx`, `main/Main.tsx`, `ReactTarget.tsx`, `header/Header.tsx`,
  `footer/Footer.tsx`, `navigation/Navigation.tsx`, `login/Login.tsx`,
  `logo/Logo.tsx`, `title/Title.tsx`, `suspense/Suspense.tsx`,
  `theme/theme.hook.tsx`, `tour/DemoTour.tsx`, `palette/Palette.tsx`
- Reusable building blocks: `section/Section.tsx`, `section/SectionCard.tsx`,
  `section/DeleteImpactPreview.tsx`, `table/*`, `components/CollectionSelect.tsx`,
  `components/FormFooter.tsx`, `components/RichTextEditor.tsx`,
  `components/RichTextView.tsx`, `components/LanguageSelector.tsx`,
  `profile-picture-input/ProfilePictureInput.tsx`,
  `drawer-stack/DrawerStackProvider.tsx`
