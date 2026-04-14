# Ant Design Tour for Demo Walkthrough

## Overview

Add a guided tour using Ant Design's built-in `<Tour>` component that walks stakeholders through all major features of the application. The tour automatically navigates between pages, highlights key UI elements, and performs interactive actions (expanding rows, switching views) to demonstrate features live.

Dev-only feature, triggered from the Settings page alongside the existing "Generate Demo Data" button.

## Architecture

A single `<Tour>` component mounted in `App.jsx`, controlled by a `TourContext` that provides ref registration and tour state management.

### Core Components

**`TourContext` (`imports/ui/tour/TourContext.jsx`)**
- React context with provider
- Holds a ref registry (`{ [key]: React.ref }`)
- Exposes `registerRef(key, ref)`, `unregisterRef(key)`
- Exposes tour state: `open`, `currentStep`, `startTour()`, `stopTour()`
- Exports `useTourRef(key)` custom hook — creates a ref, registers on mount, unregisters on unmount

**`DemoTour` (`imports/ui/tour/DemoTour.jsx`)**
- Renders `<Tour open={open} current={current} onChange={handleChange} steps={steps} />`
- Uses controlled `current` state
- Intercepts `onChange` to orchestrate page navigation before advancing steps
- Dev-only: guarded by `Meteor.isDevelopment`

**`tourSteps.js` (`imports/ui/tour/tourSteps.js`)**
- Exports a function `getTourSteps(t, refs)` that returns the step array
- Each step: `{ title, description, target: () => refs[key]?.current, page, action? }`
- Steps where `page` is `null` target always-visible elements (e.g., header) and need no navigation
- Titles and descriptions use `t('tour.*')` for i18n

### Step Transition Flow

1. User clicks Next/Previous
2. `onChange(nextStep)` fires
3. Compare `steps[nextStep].page` with current page. If `page` is `null`, skip navigation.
4. If different page:
   - Close the Tour temporarily (`open = false`) to avoid a dangling popover
   - Navigate via `setNavigationValue(page)` + `window.history.pushState`
   - Poll every 50ms for target ref to appear (max 3s timeout — accounts for lazy-load bundle download + Suspense boundary + Meteor subscription hydration)
   - Once ref appears, reopen Tour at the new step
5. If same page: proceed immediately
6. Run `step.action()` if defined (e.g., expand a row), wait 300ms for animation to settle
7. Set `current = nextStep` — Tour renders popover at target
8. Fallback: if ref never appears (timeout), show step as centered modal (antd Tour default when target returns null)

Backwards navigation uses the same logic.

**On close (X button or Escape):** Stay on the current page. Reset tour state (`open = false`, `currentStep = 0`). Do not navigate back to the starting page.

## Tour Steps

18 steps mapped from the existing demo walkthrough guide (`docs/demo-walkthrough-guide.md`):

| # | Page | Ref Key | Action | Description |
|---|------|---------|--------|-------------|
| 1 | `dashboard` | `dashboard-stats` | — | Collection statistics overview |
| 2 | `members` | `members-table` | — | Member list with search and filtering |
| 3 | `members` | `members-expanded` | Auto-expand first row | Profile details inline |
| 4 | `squads` | `squads-section` | — | Squad management |
| 5 | `orbat` | `orbat-chart` | — | Organization chart visualization |
| 6 | `ranks` | `ranks-section` | — | Rank progression chain |
| 7 | `specializations` | `specializations-section` | — | Prerequisites and instructors |
| 8 | `medals` | `medals-section` | — | Awards and decorations |
| 9 | `events` | `events-calendar` | Switch to calendar tab | Color-coded events on calendar |
| 10 | `events` | `events-attendance` | Open attendance for an event | Attendance matrix with status tags |
| 11 | `tasks` | `tasks-kanban` | Switch to Kanban view | Drag-and-drop task columns |
| 12 | `questionnaires` | `questionnaires-section` | — | Survey management |
| 13 | `registrations` | `registrations-section` | — | Recruitment pipeline |
| 14 | `roles` | `roles-section` | — | Permission structure |
| 15 | `settings` | `settings-section` | — | Community branding |
| 16 | `logs` | `logs-section` | — | Audit trail |
| 17 | `backup` | `backup-section` | — | One-click backup download |
| 18 | `null` | `header-controls` | — | Language selector and theme toggle (header is always visible) |

### Interactive Steps (Action Callbacks)

Each action uses direct DOM interaction (clicking buttons/tabs) — the simplest approach that doesn't require exposing internal component state:

- **Step 3 (Members expanded):** Query the first expand button in the table (`document.querySelector('.ant-table-row-expand-icon')`) and `.click()` it. Wait 300ms, then target the expanded row content. The antd Table expand is toggle-based, so clicking again on cleanup collapses it.

- **Step 9 (Events calendar):** The Events page has a view toggle (table/calendar). Click the calendar option via DOM: `document.querySelector('[data-tour="events-calendar-tab"]')?.click()`. This requires adding a `data-tour` attribute to the calendar toggle button in `Events.jsx` — a minimal change.

- **Step 10 (Attendance):** Click the attendance button on the first event row via `document.querySelector('[data-tour="event-attendance-btn"]')?.click()`. Requires adding a `data-tour` attribute to the attendance button in the events column definition.

- **Step 11 (Tasks kanban):** Click the Kanban view toggle via `document.querySelector('[data-tour="tasks-kanban-tab"]')?.click()`. Requires adding a `data-tour` attribute to the Kanban toggle button in `Tasks.jsx`.

Actions run after the page has loaded and refs are registered. Each action gets a cleanup function that runs when leaving the step (e.g., collapse the expanded row, switch back to table view).

## Ref Registration Pattern

No component in the project uses `React.forwardRef`. Instead of adding `forwardRef` wrappers, each page wraps its tour-targeted content in a plain `<div>` with a ref:

```javascript
// In any page component
function Dashboard() {
  const statsRef = useTourRef('dashboard-stats');
  return (
    <div ref={statsRef}>
      <Card>...</Card>  {/* existing code unchanged */}
    </div>
  );
}
```

The wrapper `<div>` is invisible (no styling) and only serves as a ref anchor. This avoids modifying any existing component APIs.

**`useTourRef` hook internals:**
1. Creates a `useRef(null)`
2. Calls `registerRef(key, ref)` on mount via `useEffect`
3. Calls `unregisterRef(key)` on cleanup
4. Key must be a static string (not dynamic) — the hook does not handle key changes

### Files Needing Ref Registration

- `Dashboard.jsx` — stats card wrapper
- `Members.jsx` — table container, expandable row area
- `Squads.jsx` — section wrapper
- `Orbat.jsx` — chart container
- `Events.jsx` — calendar container, attendance area
- `Tasks.jsx` — kanban board container
- `Ranks.jsx`, `Specializations.jsx`, `Medals.jsx` — section wrapper
- `Questionnaires.jsx`, `Registrations.jsx`, `Roles.jsx` — section wrapper
- `Settings.jsx` — settings card
- `Logs.jsx` — log table
- `Backup.jsx` — backup section
- `Header.jsx` — language selector and navigation button area

## File Structure

### New Files
- `imports/ui/tour/TourContext.jsx` — context, provider, `useTourRef` hook
- `imports/ui/tour/DemoTour.jsx` — Tour component with navigation orchestration
- `imports/ui/tour/tourSteps.js` — step definitions

### Modified Files
- `imports/ui/app/App.jsx` — wrap with `TourProvider`, mount `<DemoTour />`
- `imports/ui/settings/Settings.jsx` — add "Start Tour" button (dev-only)
- `imports/ui/header/Header.jsx` — add ref wrapper around language selector + nav button
- `imports/ui/dashboard/Dashboard.jsx` — add ref wrapper
- `imports/ui/events/Events.jsx` — add ref wrappers, add `data-tour` attributes to view toggle and attendance button
- `imports/ui/tasks/Tasks.jsx` — add ref wrapper, add `data-tour` attribute to Kanban toggle
- `imports/ui/orbat/Orbat.jsx` — add ref wrapper
- `imports/ui/members/Members.jsx` — add ref wrappers
- `imports/ui/squads/Squads.jsx` — add ref wrapper
- `imports/ui/members/ranks/Ranks.jsx` — add ref wrapper
- `imports/ui/specializations/Specializations.jsx` — add ref wrapper
- `imports/ui/members/medals/Medals.jsx` — add ref wrapper
- `imports/ui/questionnaires/Questionnaires.jsx` — add ref wrapper
- `imports/ui/registration/Registration.jsx` — add ref wrapper
- `imports/ui/members/roles/Roles.jsx` — add ref wrapper
- `imports/ui/logs/Logs.jsx` — add ref wrapper
- `imports/ui/backup/Backup.jsx` — add ref wrapper
- `imports/i18n/locales/en.json` — add `tour.*` keys
- `imports/i18n/locales/de.json` — add `tour.*` keys
- `imports/i18n/locales/fr.json` — add `tour.*` keys

## i18n

Add a `tour` section to all 3 locale files with 38 keys (18 titles + 18 descriptions + `startTour` + `startTourConfirm`):

```json
"tour": {
  "startTour": "Start Tour",
  "startTourConfirm": "Start the guided tour? This will navigate through all features.",
  "step1Title": "Dashboard",
  "step1Description": "Your home base. See collection statistics and your profile at a glance.",
  ...
}
```

## Constraints

- Dev-only (`Meteor.isDevelopment`) — not visible in production
- Requires demo data to be generated first for meaningful content
- Admin role required (tour navigates to all pages including settings/logs)
- All step text must be translated (en/de/fr)
- Tour must handle responsive layout (antd Tour handles positioning automatically)
- No new dependencies — uses antd's built-in Tour component (v5.20+)
- Lazy-loaded pages behind a Suspense boundary — 3s polling timeout accounts for bundle download + subscription hydration on slow connections
