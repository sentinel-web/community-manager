# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm start              # Start dev server (meteor run) - http://localhost:3000
npm test               # Run Mocha tests once
npm run test-app       # Run tests in watch mode with full app
npm run update         # Update all Meteor/npm packages and fix vulnerabilities
npm run visualize      # Analyze production bundle size
```

Test user auto-created in development mode only: `admin` / `admin` (requires `NODE_ENV !== 'production'`)

## Architecture

This is a **Meteor.js 3.4+** full-stack application for managing ArmA III communities, using **React 18** with **Ant Design** and **MongoDB**.

### Directory Structure

```
client/main.tsx         # Client entry point
server/main.ts          # Server setup, permissions, validation, test data
server/apis/            # API implementations (members, events, backup, logs, etc.) — *.server.ts
server/crud.lib.ts      # Generic CRUD method/publish generator
server/config.ts        # Server settings with Meteor.settings overrides
imports/api/collections/  # MongoDB collection definitions (*.collection.ts)
imports/api/types/      # Shared TS interfaces mirroring server return shapes
imports/ui/             # React components organized by feature (.tsx)
imports/i18n/           # Localization — LanguageContext.tsx, locales/
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
- Role caching with 1-minute TTL for performance
- Admin users have `roles: true` for full access

**CRUD Generation** (`server/crud.lib.ts`)
- `createCollectionMethods(collectionName)` - generates standard methods: `.read`, `.insert`, `.update`, `.delete`, `.count`, `.options`
- `createCollectionPublish(collectionName)` - generates reactive publications (requires authentication)
- All operations include permission checks and audit logging

**Configuration** (`server/config.ts`, `imports/config.ts`)
- Server settings (rate limits, cache TTL) configurable via `Meteor.settings` or `settings.json`
- UI constants (breakpoints, layout ratios) in `imports/config.ts`
- See `settings.example.json` for available overrides

**State Management**
- React Context: NavigationContext, ThemeContext, DrawerContext, SubdrawerContext, LanguageContext, PaletteContext, TourContext
- Meteor hooks: `useTracker()`, `useFind()`, `useSubscribe()` for reactive data
- Pathname-based routing without router library (reads `window.location.pathname`)

**Localization (i18n)**
- Custom lightweight i18n system in `imports/i18n/`
- Supported languages: English (en), German (de), French (fr)
- All translations in `imports/i18n/translations.ts` as a single typed `TranslationSet` (one entry per line, alphabetically sorted by dotted key; excluded from prettier so the dense per-line layout stays diff-friendly)
- Use `useTranslation()` hook to get `t()` function
- Use `useLanguage()` hook for full context (language, setLanguage, t, locales)
- Language persisted in localStorage, auto-detects browser language
- LanguageSelector component in header for switching languages

**Validation** (server/main.ts)
- `validateString()`, `validateNumber()`, `validateBoolean()`, `validateDate()`
- `validateArray()`, `validateArrayOfStrings()`, `validateObject()`, `validateUserId()`

### Collections

Members (Meteor.users), Events, Attendances, Tasks, TaskStatus, Squads, Ranks, Specializations, Medals, EventTypes, Positions, Registrations, DiscoveryTypes, Roles, ProfilePictures, Settings, Logs, Questionnaires, QuestionnaireResponses

### Collection Schemas

**Members** (Meteor.users)
- `username`, `password`, `profile: { name, id (1000-9999), roleId, squadId, rankId, navyRankId, specializationIds[], medalIds[], profilePictureId, discordTag, steamProfileLink, description, entryDate, exitDate, staticAttendancePoints, staticInactivityPoints, hasCustomArmour }`

**Events**
- `name, start, end, eventType, hosts[], attendees[], isPrivate, color, preset, description`

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
- `dashboard/`, `questionnaires/`, `registration/`, `members/`, `squads/`, `specializations/`, `logs/`, `settings/`, `backup/`
- Chrome: `app/`, `header/`, `footer/`, `navigation/`, `login/`, `theme/`, `title/`, `logo/`, `profile-picture-input/`, `suspense/`, `section/`, `table/`, `components/`

## Deployment

**Docker with Traefik** (production)
```bash
# Required environment variables
ROOT_URL=https://yourdomain.com
DOMAIN=yourdomain.com
MONGO_URL=mongodb://mongo:27017/community-manager  # default

# Optional Traefik settings
TRAEFIK_ENTRYPOINT=websecure                       # default
TRAEFIK_CERTRESOLVER=letsencrypt                   # default

# Build and run
docker compose up -d
```

- Multi-stage Dockerfile: builds Meteor app, runs on Node 20
- Requires external `traefik` network (assumes Traefik reverse proxy)
- MongoDB 7 with health checks and persistent volume

## Key Dependencies

- **react-beautiful-dnd** - Drag-and-drop for Kanban task board
- **react-big-calendar** + **rrule** - Calendar views with recurring event support
- **react-organizational-chart** - Orbat tree visualization
- **fuse.js** - Fuzzy ranking for the command palette (union of static + entity items)
- **jszip** - Backup file generation

## Coding Guidelines

**Priority Order:** Security → Performance → Usability → Developer Experience

When making tradeoffs, follow this hierarchy. Never compromise security for convenience, and prefer performant solutions over easier-to-write ones.

**Follow modern design patterns and best practices.** Write clean, maintainable code using established patterns (DRY, KISS, YAGNI, SOLID, separation of concerns). Prefer composition over inheritance, keep functions focused and testable, and avoid premature optimization while still writing efficient code.

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
- Alphabetical ordering: arrays/maps/switch cases in `server/main.ts` and `server/crud.lib.ts` (e.g. `collectionNames`, `COLLECTION_TO_MODULE`, the `getCollection()` switch) are kept in alphabetical order — preserve this when adding entries
- New `server/apis/*.server.ts` files must be imported in `server/main.ts` for their methods/publications to register

**Adding New Collections**
1. Create collection file in `imports/api/collections/` (e.g. `foo.collection.ts`)
2. Add to `getCollection()` switch in `server/crud.lib.ts`
3. Call `createCollectionMethods()` and `createCollectionPublish()` in `server/crud.lib.ts`
4. Add permission module mapping in `COLLECTION_TO_MODULE` in `server/main.ts`

### Client-Side

**React Components**
- Function components only, no class components. No `React.FC`.
- TypeScript interface for props **above** the component: `interface FooProps { ... } function Foo({ x, y }: FooProps)`
- Destructure props with defaults in the signature: `function Component({ title = '', items = [] }: ComponentProps)`
- Use `useCallback` for event handlers, `useMemo` for computed values
- Narrow `useCallback`/`useMemo` deps to specific fields (e.g. `[questionnaire?._id, questionnaire?.createdAt]`), not whole objects
- Drawer model double-cast: `drawer.drawerModel as unknown as ConcreteType` for read; `setDrawerModel(x as unknown as Record<string, unknown>)` for write
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

**Drawer Pattern**
- Access via `useContext(DrawerContext)` or `useContext(SubdrawerContext)`
- Set model, title, component, then open: `drawer.setDrawerOpen(true)`

### Testing

- Tests in `tests/` directory, imported through `tests/main.ts` (alphabetical order; imports drop the extension — Meteor's compiler-plugin chain resolves `.ts`)
- Use Mocha with Node.js native `assert` module
- Run with `npm test` (once) or `npm run test-app` (watch mode)
- See [TESTING.md](TESTING.md) for comprehensive testing strategy and best practices

### Git

- Never mention Claude or AI in commit messages
- Write clear, concise commit messages describing what changed and why

## Development Workflow

1. **GitHub Issue** - Start from a GitHub issue describing the feature/bug
2. **Create Implementation Plan** - Analyze requirements and design approach
3. **Ask Questions** - Clarify ambiguities with stakeholders
4. **Refine Plan** - Update plan based on feedback
5. **Document Plan in Issue** - Add implementation details to the GitHub issue
6. **Create Branch** - Create feature branch from issue (e.g., `feature/issue-123-description`)
7. **Implement Changes** - Write code following coding guidelines
8. **Run Tests** - Execute `npm test` and verify all pass
9. **Fix Issues** - Address any failing tests or bugs
10. **Run Code Review** - Self-review or request peer review
11. **Fix Review Issues** - Address feedback from review
12. **Validate Against CLAUDE.md** - Ensure code follows documented patterns; update CLAUDE.md if new patterns emerge
13. **Create Pull Request** - Include summary of changes and steps for testing/reproduction

## Claude Code Skills

Custom skills in `.claude/skills/` automate common development tasks:

**Workflow Skills**
| Skill | Purpose |
|-------|---------|
| `/issue` | Fetch and analyze a GitHub issue to start work |
| `/plan` | Create or refine an implementation plan |
| `/branch` | Create a properly named branch from the current issue |
| `/commit` | Create a commit with clean, descriptive message |
| `/pr` | Create a pull request with summary and testing steps |
| `/review` | Run code review against coding guidelines |
| `/validate` | Validate code against CLAUDE.md patterns |
| `/test` | Run tests, analyze failures, suggest fixes |

**Scaffolding Skills**
| Skill | Purpose |
|-------|---------|
| `/collection` | Scaffold a new MongoDB collection with all registrations |
| `/component` | Scaffold a React component following project patterns |
| `/form` | Scaffold an Ant Design form with drawer integration |
| `/section` | Scaffold a full Section page (collection, form, columns, page) |

**Debugging Skills**
| Skill | Purpose |
|-------|---------|
| `/logs` | Check recent audit logs for debugging |
| `/permissions` | Show permission structure for a module |

## Common Gotchas

**Server-Side**
- Forgetting to add collection to `getCollection()` switch in `server/crud.lib.ts`
- Using sync methods (`find`, `insert`) instead of async (`findAsync`, `insertAsync`)
- Using generic `Error` instead of `Meteor.Error(code, message)`
- Missing permission module mapping in `COLLECTION_TO_MODULE`
- Forgetting `createLog()` for audit trail on custom methods
- Not checking `this.userId` before operations

**Client-Side**
- Missing dependency array in `useFind()`, `useCallback()`, `useMemo()`
- Widened `useCallback`/`useMemo` deps to whole objects instead of narrow fields (causes spurious re-runs)
- Forgetting `useSubscribe()` before `useFind()` (data won't load)
- Not using `App.useApp()` for notifications (won't render in drawer context)
- Forgetting to narrow `Meteor.callAsync` return type (defaults to `unknown` under strict)
- Using `?.` on `member.profile.X` access — masks crashes; use `!` non-null assertion to preserve original behavior
- Switching `<Tag color={X || 'transparent'}>` to `?? undefined` — removes the visual fallback for nullable colors
- Using `useEffect` for derived state instead of `useMemo`

**Forms**
- Forgetting `initialValues={model}` (edit mode won't populate)
- Missing `valuePropName="checked"` for Switch/Checkbox Form.Items
- Not handling both create (no `_id`) and update (has `_id`) in `handleFinish`

**Permissions**
- Adding new CRUD module but forgetting to add to `CRUD_MODULES` array
- Not passing `permissionModule` prop to Section when collection name differs

## Code Style

- Prettier: 2-space indent, single quotes, trailing commas (es5), 150 char width, `arrowParens: "avoid"`
- TypeScript: `strict: true` (no implicit any, strict null checks, unknown catch variables, etc.)
- TypeScript interfaces above each component for props validation

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `sentinel-web/community-manager`, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` and `docs/adr/` at the repo root (will be created lazily by `/grill-with-docs`). See `docs/agents/domain.md`.
