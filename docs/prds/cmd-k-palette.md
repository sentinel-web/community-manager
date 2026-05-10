# PRD: Cmd+K Command Palette

**Status:** Proposed
**Author:** Oke Johannsen
**Last updated:** 2026-05-10

## Problem

Navigation in the app today goes through a single hamburger Dropdown in the header (`imports/ui/navigation/Navigation.tsx`). Reaching any of the 18 sections requires two clicks; finding a specific entity (a member named Viper, an event called "Operation Dawn") requires navigating to the right section first, then using its in-page search. Power users — officers triaging registrations, admins maintaining members — feel the friction repeatedly throughout a session.

A Cmd+K palette collapses navigate / search / act into a single keyboard-driven surface.

## Goals

1. Let any authenticated user jump to any section, find any entity they have permission to read, and trigger any creation flow without leaving the keyboard.
2. Respect the existing permission model exactly — never surface a result the user can't reach through the menu.
3. Stay loyal to the project's "fully Ant Design" guideline; ship no second design system.

## Non-goals (v1)

- Per-result sub-actions (edit / delete / duplicate from inside the palette)
- Slash-mode prefixes (`@member`, `#event`, `>action`)
- Mobile / touch support — the palette is desktop-only
- Server-synced recents — local to each browser
- Audit logging of search queries

## Users

- **Admins** (role.roles === true): full access; palette searches every collection unrestricted
- **Officers** (role.roles is module-keyed; some have squad scope): palette respects per-module read permissions and squad-scoped Members publication via `getSquadScope(userId)`
- **Members** (limited role): palette only shows what their role allows — typically navigate to a few sections, search Members in their squad

## User stories

- *As an admin*, I press Cmd+K, type "vip", press Enter, and land on the Members detail for Viper.
- *As an officer*, I press Ctrl+K, type "create event", press Enter, and the Events page opens with the create drawer already showing.
- *As a member with no events permission*, my palette never shows event results or the "Create event" action.
- *As a returning user*, my last 5 selections appear on top when I open the palette empty.

## Functional requirements

### Trigger

- Hotkey `Cmd+K` (Mac) / `Ctrl+K` (Win/Linux) — listened at App level via `keydown`.
- Handler calls `event.preventDefault()` to override the browser/Slack defaults.
- Pressing the hotkey while the palette is open closes it (toggle).
- `Esc` closes; clicking outside the modal closes.
- No visible button — discoverability via tooltip on the navigation Button reading `Cmd+K`.

### Empty state (no input)

Two sections, in order:

1. **Recents** (≤5 items, frecency-ranked from `localStorage`)
2. **All** — every navigate target the user has permission for, plus the 6 Create-X actions, plus Switch language / Toggle theme / Logout

If Recents is empty, the section header is hidden.

### Searching (input ≥ 1 char)

- 150ms debounce on input change.
- Server method `palette.search` runs case-insensitive Mongo regex against the 6 searchable collections, capped at 30 candidates per type.
- Client merges server results with the static (navigate / action) item set, then runs Fuse.js over the union to score and rank.
- Recents items get a frecency boost added to their Fuse score.
- Results grouped by type with section headers: Recent / Members / Events / Tasks / Squads / Registrations / Questionnaires / Navigate / Actions.
- Each group caps at 8 visible rows.

### Result selection

| Result kind | Behavior on Enter |
|-------------|-------------------|
| Navigate    | `pushState('/<route>')` |
| Entity      | `pushState('/<route>/?id=<_id>')` (or per-section convention) |
| Create-X    | `pushState('/<route>?action=create')`; section reads `searchParams` on mount, opens its create drawer, calls `replaceState` to strip the param |
| Switch language | Cycles `en → de → fr → en` via `LanguageContext.setLanguage` |
| Toggle theme | Calls `ThemeContext.toggleTheme` |
| Logout       | Calls `Meteor.logout()` |

After selection, the palette closes and the chosen item is pushed to Recents.

### Searchable fields per collection

| Collection      | Fields                                    | Permission gate                       |
|-----------------|-------------------------------------------|---------------------------------------|
| Members         | `profile.name`, `username`, `profile.id`  | `members` read + `getSquadScope`     |
| Events          | `name`                                    | `events` read                         |
| Tasks           | `name`                                    | `tasks` read                          |
| Squads          | `name`                                    | `squads` read                         |
| Registrations   | `name`                                    | `registrations` read                 |
| Questionnaires  | `name`                                    | `questionnaires` read                 |

## API contract

### `palette.search(query: string, limit?: number)`

```ts
type PaletteSearchResult = {
  members:        Pick<Member, '_id' | 'username' | 'profile'>[];
  events:         Pick<Event, '_id' | 'name' | 'start'>[];
  tasks:          Pick<Task, '_id' | 'name' | 'status'>[];
  squads:         Pick<Squad, '_id' | 'name' | 'color'>[];
  registrations:  Pick<Registration, '_id' | 'name' | 'id'>[];
  questionnaires: Pick<Questionnaire, '_id' | 'name' | 'status'>[];
};
```

- `query` validated via `validateString()`; throws `Meteor.Error(400, …)` if empty after trim.
- `limit` per type defaults to 8, capped at 30. Validated via `validateNumber()`.
- Returns empty arrays for collections the user has no read permission on (no error).
- Does **not** call `createLog()`.
- Throws `Meteor.Error(401, 'Unauthorized')` if `!this.userId`.

## Architecture

### New files

```
imports/ui/palette/
  Palette.tsx              # Modal + Input + List, hand-rolled keyboard nav
  PaletteContext.tsx       # { open, setOpen, recents, addRecent }
  palette.types.ts         # PaletteItem, PaletteResultGroup discriminated union
  palette.scoring.ts       # Fuse.js setup + frecency formula
server/apis/
  palette.server.ts        # palette.search method
imports/i18n/locales/
  en.json, de.json, fr.json # +palette.* keys
```

### Wiring

- `PaletteContext` provider mounted at App level (`imports/ui/app/App.tsx`) above existing contexts.
- App-level `useEffect` registers the keydown listener.
- `<Palette />` rendered at App level so it overlays any route.
- Section pages (Members, Events, Tasks, Squads, Registrations, Questionnaires) gain a `useEffect` reading `URLSearchParams` for `action=create`; if present, opens the section's create drawer and `replaceState` to strip.

### Recents storage

- localStorage key: `cm.palette.recents`
- Schema: `Array<{ kind: 'navigate' | 'action' | 'entity'; key: string; label: string; ts: number; count: number }>`
- Capped at 10. Items not selected in 30 days dropped on next read.
- Frecency score: `log10(count + 1) * exp(-(now - ts) / (14 * day_ms))`
- Cleanup: when a recent entity is selected and the server returns no record (deleted), remove it.

## i18n keys

```jsonc
"palette": {
  "placeholder": "Search…",
  "recent": "Recent",
  "members": "Members",
  "events": "Events",
  "tasks": "Tasks",
  "squads": "Squads",
  "registrations": "Registrations",
  "questionnaires": "Questionnaires",
  "navigate": "Navigate",
  "actions": "Actions",
  "createMember": "Create member",
  "createEvent": "Create event",
  "createTask": "Create task",
  "createSquad": "Create squad",
  "createRegistration": "Create registration",
  "createQuestionnaire": "Create questionnaire",
  "switchLanguage": "Switch language",
  "toggleTheme": "Toggle theme",
  "logout": "Logout",
  "noResults": "No results"
}
```

All three locales (en/de/fr) updated; German and French translations TBD.

## Accessibility

- Modal traps focus; `Esc` returns focus to trigger element.
- `<input role="combobox" aria-expanded="true" aria-controls="palette-listbox" aria-activedescendant="palette-item-<n>">`.
- Result list `role="listbox"`; each row `role="option"`.
- Screen reader announces result count change after debounce settles (`aria-live="polite"` on count region).

## Acceptance criteria

1. Cmd+K (Mac) / Ctrl+K (Win/Linux) opens the palette from any route. Pressing the same hotkey again, or `Esc`, closes it.
2. With empty input, palette shows Recents (if any) followed by all permitted nav routes + 6 Create-X actions + 3 global controls.
3. Typing a query returns results from the 6 searchable collections within 200ms (debounce + server roundtrip on localhost).
4. A user without `events` permission never sees event results, the "Create event" action, or the Events nav row.
5. Squad-scoped officers searching Members see only their squad's members.
6. Selecting a navigate result pushes the new route. Selecting a Create-X navigates to that route and opens its create drawer. Selecting an entity navigates to the appropriate detail/list. Selecting a global control fires the matching context method.
7. The 5 most-recent selections persist across page reloads via `localStorage`.
8. No `palette.search` call appears in the Logs collection.
9. Keyboard-only navigation works: ↑/↓ moves selection, Enter activates, Tab is trapped inside the modal.
10. Existing 168 unit tests stay green; new tests cover `palette.search` permission gating, squad scoping, recents frecency formula.

## Implementation phases

1. **Server** — `palette.server.ts` method, register in `server/main.ts`, unit tests for permission gating + squad scope. ~½ day.
2. **Context + hotkey** — `PaletteContext`, App-level keydown listener, no UI yet (just toggle a `console.log`). ~2 hours.
3. **Modal shell** — Antd Modal + Input + plain List rendering grouped static items with permissions. ~½ day.
4. **Server integration** — wire `palette.search` into the modal with debounce; add Fuse.js scoring. ~½ day.
5. **Create-X flow** — section page `searchParams` reading + drawer auto-open. ~½ day.
6. **Recents** — localStorage helper, frecency boost, empty-state hybrid. ~½ day.
7. **Accessibility pass** — ARIA roles, focus trap, screen reader announcements. ~2 hours.
8. **i18n** — keys + en + stubs for de/fr. ~1 hour.
9. **E2E tests** — at least one Playwright test covering open → type → select-entity → land-on-detail. ~2 hours.

Total estimate: ~3 working days.

## Open questions

- Translations for German and French — defer to translator review or stub in English first?
- Should the palette show a tooltip "Press ⌘K" somewhere on first session for discoverability, given there's no visible button?
