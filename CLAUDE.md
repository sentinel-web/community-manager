# CLAUDE.md

Guidance for Claude Code working in this repository.

## Development Commands

```bash
npm start              # Start dev server (meteor run) - http://localhost:3000
npm test               # Run Mocha tests once
npm run test-app       # Run tests in watch mode with full app
npm run update         # Update all Meteor/npm packages and fix vulnerabilities
npm run visualize      # Analyze production bundle size
```

Test user auto-created in development mode only: `admin` / `admin` (requires `NODE_ENV !== 'production'`).

**Demo Data Generation** (`server/apis/demoData.server.ts`) — comprehensive sample data (all reference collections, members, events, attendances, tasks, questionnaires + responses, registrations, briefing templates, settings) generated on demand, dev-only:
- **Trigger (UI):** Settings page → "Generate Demo Data" (`DemoDataSettings` in `imports/ui/settings/Settings.tsx`) → `Popconfirm` → `Meteor.callAsync('demoData.generate')` → success alert + `window.location.reload()`
- **Server method** (`demoData.generate`): rejects in production (403) → `validateUserId` → `checkPermission(userId, 'settings')` → `wipeAllCollections()` → `insertDemoData()` → `createLog('demoData.generated')`
- **Destructive — full reset, not append:** `wipeAllCollections()` empties every collection before reseeding. Seeds use fixed explicit `_id`s; reference collections are inserted before the members/events/etc. that FK-reference them
- **Adding a collection:** wire it into both `wipeAllCollections()` and `insertDemoData()` (and keep both alphabetical), or its data silently leaks across regenerations
- Rich-text seed fields (event `description`, briefing-template `content`) must use only tags from the sanitizer allow-list (`imports/api/htmlSanitizer/sanitizePolicy.ts`)

## Architecture

This is a **Meteor.js 3.4+** full-stack application for managing ArmA III communities, using **React 18** with **Ant Design** and **MongoDB**.

### Directory Structure

```
client/main.tsx         # Client entry point
server/main.ts          # Server setup, permissions, validation, dev admin user
server/apis/            # API implementations (members, events, backup, logs, etc.) — *.server.ts
server/apis/demoData.server.ts  # On-demand demo-data seeder (demoData.generate, dev only)
server/crud.lib.ts      # Generic CRUD method/publish generator
server/collection-registry.ts  # Per-collection permission/FK/audit metadata (COLLECTION_REGISTRY)
server/mutation-pipeline.ts    # Shared server-mutation lifecycle (runMutation: auth→perm→validate→body→audit)
server/config.ts        # Server settings with Meteor.settings overrides
imports/api/collections/  # MongoDB collection definitions (*.collection.ts)
imports/api/types/      # Shared TS interfaces mirroring server return shapes
imports/ui/             # React components organized by feature (.tsx)
imports/i18n/           # Localization — LanguageContext.tsx, translations.ts
imports/helpers/        # Utility functions (.ts)
imports/config.ts       # UI constants (breakpoints, layout ratios)
imports/types/          # Ambient module declarations (.d.ts)
settings.example.json   # Example configuration overrides
```

The codebase is **fully TypeScript** with `strict: true`. No `.jsx` or untyped `.js` files in `imports/`, `server/`, or `client/`.

### Key Patterns

**Permission System**
- Two-tier RBAC: boolean modules (dashboard, orbat, logs, settings) and CRUD modules (members, events, tasks, etc.)
- Permission check: `checkPermission(userId, module, operation)` in `server/main.ts`
- Per-collection permission/FK/audit metadata lives in `COLLECTION_REGISTRY` (`server/collection-registry.ts`), a `Record<CrudCollectionName, CollectionRegistryEntry>`: `module`, optional `fallback` (e.g. `canCreateEvents`), `allowsAnonymous`, `redact`, `foreignKeys`, `displayField`
- Role caching with 1-minute TTL for performance
- Admin users have `roles: true` for full access

**Server-Mutation Lifecycle** (`server/mutation-pipeline.ts`)
- `runMutation(ctx, descriptor, args, body)` owns the standard mutation lifecycle: auth → permission → validate → body → audit. Both the CRUD factory and custom methods route through it, so there is exactly one implementation
- Pre-body failures emit a `<collection>.<op>.denied` audit entry before throwing; body errors propagate untouched (a `Meteor.Error('Code', …)` reaches the caller intact)

**CRUD Generation** (`server/crud.lib.ts`)
- `createCollectionMethods(collectionName)` - generates standard methods: `.read`, `.insert`, `.update`, `.delete`, `.count`, `.options` (each wrapped by `runMutation`)
- `createCollectionPublish(collectionName)` - generates reactive publications (authenticated unless the registry sets `allowsAnonymous.read`)
- All operations include permission checks and audit logging

**Configuration**
- Server settings (rate limits, cache TTL) in `server/config.ts`, overridable via `Meteor.settings`/`settings.json` (see `settings.example.json`); UI constants (breakpoints, layout ratios) in `imports/config.ts`

**State Management**
- React Context: NavigationContext, ThemeContext, LanguageContext, PaletteContext, TourContext
- Nested entity editing uses the **DrawerStack** module (`imports/ui/drawer-stack/`), which replaced the old `DrawerContext`/`SubdrawerContext` pair — see the Drawer Pattern section
- Meteor hooks: `useTracker()`, `useFind()`, `useSubscribe()` for reactive data
- Pathname-based routing without router library (reads `window.location.pathname`)

**Localization (i18n)** (`imports/i18n/`)
- Languages en/de/fr. All translations in `translations.ts` as one typed `TranslationSet` (one entry per line, sorted by dotted key, prettier-excluded). See `CONTEXT.md` → LocaleSet
- `useTranslation()` for `t()`; `useLanguage()` for full context. Language persisted to localStorage + browser-autodetected; `LanguageSelector` in header

**Validation** (server/main.ts)
- `validateString()`, `validateNumber()`, `validateBoolean()`, `validateDate()`
- `validateArray()`, `validateArrayOfStrings()`, `validateObject()`, `validateUserId()`

**Rich Text**
- Only two surfaces are rich text: the briefing-template `content` and the event `description`. Every other `description` field stays plain text
- Stored as sanitized HTML and sanitized twice — server write path (`sanitize-html`) and client render just before DOM injection (DOMPurify) — against one shared allow-list in `imports/api/htmlSanitizer/sanitizePolicy.ts`. See `CONTEXT.md` → BriefingTemplate.

### Collections

Members (Meteor.users), Events, Attendances, Tasks, TaskStatus, Squads, Ranks, Specializations, Medals, EventTypes, Positions, Registrations, DiscoveryTypes, Roles, ProfilePictures, Settings, Logs, Questionnaires, QuestionnaireResponses, BriefingTemplates

Field-level schemas for every collection: [`docs/collections.md`](docs/collections.md).

### UI Components

**Reusable Components**
| Component | Location | Purpose |
|-----------|----------|---------|
| `Section` | `imports/ui/section/` | Generic CRUD page with table, filtering, drawer |
| `SectionCard` | `imports/ui/section/` | Card wrapper with title and loading state |
| `CollectionSelect` | `imports/ui/components/` | Multi-select dropdown with inline create/edit |
| `FormFooter` | `imports/ui/components/` | Submit/cancel buttons for drawer forms |
| `Table` | `imports/ui/table/` | Data table component |
| `TableHeader` | `imports/ui/table/header/` | Search input and create button |
| `TableFooter` | `imports/ui/table/footer/` | Load more button with count |
| `TableContainer` | `imports/ui/table/body/` | Scrollable table wrapper |

**Feature Folders** in `imports/ui/`:
- `events/` - Calendar, attendance, table views
- `tasks/` - Kanban board with drag-and-drop
- `orbat/` - Organization chart
- `palette/` - Cmd+K command palette (fuzzy ranking, recents, global UI controls)
- `tour/` - First-run guided tour
- `drawer-stack/` - Nested-drawer editing module (see Drawer Pattern)
- `briefing-templates/` - Rich-text briefing templates loaded into event descriptions
- `dashboard/`, `questionnaires/`, `registration/`, `members/`, `squads/`, `specializations/`, `logs/`, `settings/`, `backup/`
- Chrome: `app/`, `header/`, `footer/`, `navigation/`, `login/`, `theme/`, `title/`, `logo/`, `profile-picture-input/`, `suspense/`, `section/`, `table/`, `components/`

## Deployment

Docker + Traefik (production), Node 22, MongoDB 7. Full env vars and compose notes: [`docs/deployment.md`](docs/deployment.md).

## Key Dependencies

`react-beautiful-dnd` (Kanban DnD), `react-big-calendar` + `rrule` (recurring-event calendar), `react-organizational-chart` (ORBAT tree), `fuse.js` (command-palette fuzzy ranking), `jszip` (backup files).

## Coding Guidelines

**Priority Order:** Security → Performance → Usability → Developer Experience

Follow this hierarchy when making tradeoffs — never compromise security for convenience. Otherwise write clean, maintainable code (DRY, KISS, YAGNI, SOLID, composition over inheritance, focused/testable functions) without premature optimization.

### Server-Side

**Meteor Methods**
- Use `async` functions with `*Async` collection methods (`findOneAsync`, `insertAsync`, `updateAsync`, `removeAsync`)
- Validate all inputs using helpers: `validateString()`, `validateObject()`, etc.
- Check authentication: `if (!this.userId) throw new Meteor.Error(401, 'Unauthorized')`
- Check permissions: `await checkPermission(this.userId, module, operation)`
- Use `Meteor.Error(code, message)` for errors (not generic Error)
- Log mutations with `createLog(action, data)` for audit trail

**Server File Conventions**
- One API per file: each `server/apis/<feature>.server.ts` contains only methods/publications matching its name (e.g. `squads.*` lives in `squads.server.ts`, not scattered across files)
- Alphabetical ordering: arrays/maps/switch cases (e.g. `collectionNames`, `COLLECTION_REGISTRY` in `server/collection-registry.ts`, the `getCollection()` switch in `server/crud.lib.ts`) are kept in alphabetical order — preserve this when adding entries
- New `server/apis/*.server.ts` files must be imported in `server/main.ts` for their methods/publications to register

**Adding New Collections**
1. Create collection file in `imports/api/collections/` (e.g. `foo.collection.ts`)
2. Add the name to the `CrudCollectionName` union in `imports/api/types/` (this forces a `COLLECTION_REGISTRY` entry — omitting it is a compile error)
3. Add to `getCollection()` switch in `server/crud.lib.ts`
4. Call `createCollectionMethods()` and `createCollectionPublish()` in `server/crud.lib.ts`
5. Add the registry entry (at least `{ module }`) in `COLLECTION_REGISTRY` (`server/collection-registry.ts`)

### Client-Side

**React Components**
- Function components only, no class components. No `React.FC`.
- TypeScript interface for props **above** the component: `interface FooProps { ... } function Foo({ x, y }: FooProps)`
- Destructure props with defaults in the signature: `function Component({ title = '', items = [] }: ComponentProps)`
- Use `useCallback` for event handlers, `useMemo` for computed values
- Narrow `useCallback`/`useMemo` deps to specific fields (e.g. `[questionnaire?._id, questionnaire?.createdAt]`), not whole objects
- Drawer forms read their model from the frame: `const { model } = useDrawerFrame<R, M>()` (see Drawer Pattern); openers pass it via `push({ model, ... })`
- Section generic: `<Section<EntityType> Collection={EntityCollection} columnsFactory={getEntityColumns} ... />`
- Section column factory: `const getEntityColumns: ColumnsFactory<Entity> = (handleEdit, handleDelete, permissions, t) => [...]`
- For nullable string fields at antd DOM boundaries (Tag, Picker), convert with `?? undefined` *only* at the DOM site — never on a server-write path
- Color render preservation: `<Tag color={color || 'transparent'}>` (NOT `?? undefined`)

**Meteor Data Hooks**
```typescript
useSubscribe(collectionName, filter, options);           // Subscribe to data
const data = useFind(() => Collection.find(filter), [filter]);  // Reactive query
const user = useTracker(() => Meteor.user(), []);        // Reactive Meteor data
```

**Meteor Method Calls**
```typescript
// Use callAsync with try/catch or .then/.catch.
// Narrow the return type since Meteor.callAsync<T> is not typed: cast the result.
try {
  const result = (await Meteor.callAsync('collection.method', ...args)) as ReturnShape;
  message.success('Success');
} catch (error) {
  // Catch variables are 'unknown' under strict; narrow before access.
  const err = error as Meteor.Error;
  notification.error({ message: err.error as string, description: err.message });
}
```

**Forms (Ant Design)**
- Use `<Form layout="vertical" initialValues={model} onFinish={handleFinish}>`
- Form.Item with `name`, `label`, `rules` props
- For nested form paths (e.g. members `profile.X`), use `name={['profile', 'X']}` and type `name?: NamePath` on Select wrappers
- Type the form: `const [form] = Form.useForm<EntityFormValues>()` when the values shape is well-defined; `Form.useForm<Record<string, unknown>>()` for dynamic-key forms (e.g. RolesForm permissions)
- Get notification/message from `App.useApp()` hook (never the static antd singleton — won't render inside drawer context)
- For nullable wire-format fields, mirror server's `string | null` exactly; only convert at the antd DOM boundary with `?? undefined`

**Drawer Pattern** (`imports/ui/drawer-stack/` — replaced `DrawerContext`/`SubdrawerContext`; there is no depth-aware code anymore)
- **Openers** (`Section`, `CollectionSelect`, `Palette`) use `const { push } = useDrawerStack()`, then `const result = await push<R, M>({ title, Component, model, extra? })`. The promise resolves with whatever the form passes to `resolve`, or `undefined` if cancelled — so `CollectionSelect` can open a create-form inline and auto-select the returned doc
- **Forms** use `const { model, resolve, cancel } = useDrawerFrame<R, M>()` — they resolve the nearest frame and never know their depth (no `useSubdrawer` prop, no `setOpen`)
- **Unsaved-state guards** use `useConfirmClose(predicate)` — the predicate (returning `boolean | Promise<boolean>`) runs only on user-initiated close (X/mask); `resolve`/`cancel` from inside the form skip it
- See `CONTEXT.md` → DrawerStack for the full contract

### Testing

- Tests in `tests/` directory, imported through `tests/main.ts` (alphabetical order; imports drop the extension — Meteor's compiler-plugin chain resolves `.ts`)
- Use Mocha with Node.js native `assert` module
- Run with `npm test` (once) or `npm run test-app` (watch mode)
- See [TESTING.md](TESTING.md) for comprehensive testing strategy and best practices

### Git

- Never mention Claude or AI in commit messages
- Write clear, concise commit messages describing what changed and why

## Development Workflow

Issue → plan → branch → implement → test → review → PR. Full step list: [`docs/agents/workflow.md`](docs/agents/workflow.md).

## Claude Code Skills

Custom skills in `.claude/skills/` automate common tasks (available skills are also surfaced each session):
- **Workflow:** `/issue`, `/plan`, `/branch`, `/commit`, `/pr`, `/review`, `/validate`, `/test`
- **Scaffolding:** `/collection`, `/component`, `/form`, `/section`
- **Debugging:** `/logs`, `/permissions`

## Common Gotchas

Non-obvious traps only; the coding rules above aren't repeated here.

**Server-Side**
- Forgetting to add a collection to the `getCollection()` switch (`crud.lib.ts`) or its `COLLECTION_REGISTRY` entry — the latter is a compile error via `Record<CrudCollectionName, _>`
- Using sync collection methods (`find`, `insert`) instead of async (`findAsync`, `insertAsync`)

**Client-Side**
- Forgetting `useSubscribe()` before `useFind()` (data won't load), or a missing dependency array in `useFind`/`useCallback`/`useMemo`
- Using `?.` on `member.profile.X` access — masks crashes; use `!` non-null assertion to preserve original behavior
- Using `useEffect` for derived state instead of `useMemo`

**Forms**
- Missing `valuePropName="checked"` for Switch/Checkbox Form.Items
- Not handling both create (no `_id`) and update (has `_id`) in `handleFinish`

**Permissions**
- Not passing `permissionModule` prop to Section when collection name differs from the permission module

## Code Style

- Prettier: 2-space indent, single quotes, trailing commas (es5), 150 char width, `arrowParens: "avoid"`
- TypeScript: `strict: true` (no implicit any, strict null checks, unknown catch variables, etc.)

## Agent skills

- **Issue tracker** — GitHub Issues at `sentinel-web/community-manager` via the `gh` CLI. See `docs/agents/issue-tracker.md`
- **Triage labels** — five canonical: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`
- **Domain docs** — single-context repo: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by `/grill-with-docs`). See `docs/agents/domain.md`
