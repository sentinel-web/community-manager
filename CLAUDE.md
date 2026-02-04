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
client/main.jsx         # Client entry point
server/main.js          # Server setup, permissions, validation, test data
server/apis/            # API implementations (members, events, backup, logs, etc.)
server/crud.lib.js      # Generic CRUD method/publish generator
server/config.js        # Server settings with Meteor.settings overrides
imports/api/collections/  # MongoDB collection definitions (16 collections)
imports/ui/             # React components organized by feature
imports/i18n/           # Localization (i18n) - LanguageContext, locales/
imports/helpers/        # Utility functions
imports/config.js       # UI constants (breakpoints, layout ratios)
settings.example.json   # Example configuration overrides
```

### Key Patterns

**Permission System**
- Two-tier RBAC: boolean modules (dashboard, orbat, logs, settings) and CRUD modules (members, events, tasks, etc.)
- Permission check: `checkPermission(userId, module, operation)` in `server/main.js`
- Role caching with 1-minute TTL for performance
- Admin users have `roles: true` for full access

**CRUD Generation** (`server/crud.lib.js`)
- `createCollectionMethods(collectionName)` - generates standard methods: `.read`, `.insert`, `.update`, `.delete`, `.count`, `.options`
- `createCollectionPublish(collectionName)` - generates reactive publications (requires authentication)
- All operations include permission checks and audit logging

**Configuration** (`server/config.js`, `imports/config.js`)
- Server settings (rate limits, cache TTL) configurable via `Meteor.settings` or `settings.json`
- UI constants (breakpoints, layout ratios) in `imports/config.js`
- See `settings.example.json` for available overrides

**State Management**
- React Context: NavigationContext, ThemeContext, DrawerContext, SubdrawerContext, LanguageContext
- Meteor hooks: `useTracker()`, `useFind()`, `useSubscribe()` for reactive data
- Pathname-based routing without router library (reads `window.location.pathname`)

**Localization (i18n)**
- Custom lightweight i18n system in `imports/i18n/`
- Supported languages: English (en), German (de), French (fr)
- Locale files in `imports/i18n/locales/` as JSON
- Use `useTranslation()` hook to get `t()` function
- Use `useLanguage()` hook for full context (language, setLanguage, t, locales)
- Language persisted in localStorage, auto-detects browser language
- LanguageSelector component in header for switching languages

**Validation** (server/main.js)
- `validateString()`, `validateNumber()`, `validateBoolean()`, `validateDate()`
- `validateArray()`, `validateArrayOfStrings()`, `validateObject()`, `validateUserId()`

### Collections

Members (Meteor.users), Events, Attendances, Tasks, TaskStatus, Squads, Ranks, Specializations, Medals, EventTypes, Registrations, DiscoveryTypes, Roles, ProfilePictures, Settings, Logs, Questionnaires, QuestionnaireResponses

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
- `name, color, description` + boolean permissions (`dashboard, orbat, logs, settings`) + CRUD permissions (`members, events, tasks, squads, ranks, specializations, medals, eventTypes, taskStatus, registrations, discoveryTypes, roles, questionnaires`)

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
- `members/`, `squads/`, `logs/`, `settings/`, `backup/`

## Key Dependencies

- **react-beautiful-dnd** - Drag-and-drop for Kanban task board
- **react-big-calendar** + **rrule** - Calendar views with recurring event support
- **react-organizational-chart** - Orbat tree visualization
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

**Adding New Collections**
1. Create collection file in `imports/api/collections/`
2. Add to `getCollection()` switch in `server/crud.lib.js`
3. Call `createCollectionMethods()` and `createCollectionPublish()` in `server/crud.lib.js`
4. Add permission module mapping in `COLLECTION_TO_MODULE` in `server/main.js`

### Client-Side

**React Components**
- Function components only, no class components
- PropTypes required for all props (define after component)
- Destructure props with defaults: `function Component({ title = '', items = [] })`
- Use `useCallback` for event handlers, `useMemo` for computed values

**Meteor Data Hooks**
```javascript
useSubscribe(collectionName, filter, options);           // Subscribe to data
const data = useFind(() => Collection.find(filter), [filter]);  // Reactive query
const user = useTracker(() => Meteor.user(), []);        // Reactive Meteor data
```

**Meteor Method Calls**
```javascript
// Use callAsync with try/catch or .then/.catch
try {
  const result = await Meteor.callAsync('collection.method', ...args);
  message.success('Success');
} catch (error) {
  notification.error({ message: error.error, description: error.message });
}
```

**Forms (Ant Design)**
- Use `<Form layout="vertical" initialValues={model} onFinish={handleFinish}>`
- Form.Item with `name`, `label`, `rules` props
- Get notification/message from `App.useApp()` hook

**Drawer Pattern**
- Access via `useContext(DrawerContext)` or `useContext(SubdrawerContext)`
- Set model, title, component, then open: `drawer.setDrawerOpen(true)`

### Testing

- Tests in `tests/` directory, imported through `tests/main.js`
- Use Mocha/Chai syntax
- Run with `npm test` (once) or `npm run test-app` (watch mode)

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

## Common Gotchas

**Server-Side**
- Forgetting to add collection to `getCollection()` switch in `server/crud.lib.js`
- Using sync methods (`find`, `insert`) instead of async (`findAsync`, `insertAsync`)
- Using generic `Error` instead of `Meteor.Error(code, message)`
- Missing permission module mapping in `COLLECTION_TO_MODULE`
- Forgetting `createLog()` for audit trail on custom methods
- Not checking `this.userId` before operations

**Client-Side**
- Missing dependency array in `useFind()`, `useCallback()`, `useMemo()`
- Forgetting `useSubscribe()` before `useFind()` (data won't load)
- Not using `App.useApp()` for notifications (won't render in drawer context)
- Missing PropTypes for component props
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
- PropTypes for React component props validation
