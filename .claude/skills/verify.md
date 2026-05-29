# /verify

Browser-driven verification loop for this Meteor + React app. Spin up the dev
server, drive the UI as `admin`, prove a change actually works, and grow this
skill whenever a new blocker comes up.

CLAUDE.md is explicit: **type checking and test suites verify code correctness,
not feature correctness**. This skill is how Claude closes that gap without
asking the user to click around.

## Evaluate against a contract, with fresh eyes

The agent that wrote the code is the worst judge of whether it works — it grades
toward the behavior it intended. So `/verify` is an **adversarial evaluation
against a pre-agreed contract**, not a self-review:

1. **The contract comes from `/plan`.** Before any code is written, `/plan`
   writes an implementation-*independent* acceptance contract to
   `.claude/verify-contract.md` — plain-language "given/when/then" criteria
   describing observable behavior, with no reference to functions, files, or
   how it's built. `/verify` is scored **only** against those criteria.
2. **Evaluate with fresh eyes.** Grade against the contract **only** — read it,
   not the implementation transcript, so you judge what the app *does*, not what
   you *meant*. Best: hand the evaluation to a fresh sub-agent (the Task tool)
   whose prompt is the contract plus how to reach the app, so it literally has no
   memory of the implementation. (The browser access here is Chrome MCP, driven
   from the session — see *Prerequisites*; a sub-agent that lacks it should report
   what it cannot reach rather than guess.) Emit an explicit **PASS / FAIL per
   criterion**.
3. **Keep the code-correctness gates in the main thread.** Run
   `npm run typecheck`, `npm test`, and `npm run e2e` in the main session — do
   **not** delegate them to the evaluator sub-agent, or a failure's output gets
   summarized away instead of stopping you. Feature evaluation and code gates
   are separate passes.

If there is no `.claude/verify-contract.md` (older flow), derive the criteria
from the issue first and write them down before driving — grading against an
unwritten standard is how confirmation bias creeps back in.

## Stable selectors: `data-verify-*`

Assert against `data-verify-*` attributes, not localized DOM text or Ant Design
class names — text changes with i18n and markup changes with antd upgrades, both
of which would make a passing check silently rot. **None exist yet** — this is the
convention to introduce, adding a stable attribute to each load-bearing widget the
first time you instrument its path, e.g.:

- attendance tally → `data-verify="attendance-tally" data-verify-count={n}`
- ORBAT node count → `data-verify="orbat-count" data-verify-count={n}`
- kanban column total → `data-verify="kanban-column-total" data-verify-count={n}`

Instrument incrementally — add the attribute when a criterion needs it, so the
attribute set grows with the contracts that depend on it rather than all at once.

## Usage

`/verify` — verify recent uncommitted changes against the relevant golden path(s)
`/verify <feature>` — verify a named area (e.g. `/verify events`, `/verify kanban`)
`/verify --reset` — wipe and reseed via demo data before verifying

## Prerequisites

- Chrome MCP enabled (the global `/chrome` Claude-in-Chrome integration —
  not a project skill); if missing, follow the setup prompt and stop
- `NODE_ENV !== 'production'` — the dev admin user and demo-data method only
  exist in development mode
- Working directory is the repo root (Meteor needs `.meteor/` adjacent)

## The loop

1. **Bring up the stack** — start the dev server if it isn't already running
2. **Authenticate** — log in as the dev admin
3. **Set up state** — only if the change needs specific data Claude doesn't
   already see
4. **Drive the UI** — exercise the golden path for the affected feature
5. **Prove it works** — screenshot before/after, check logs, check DB state if
   relevant
6. **Report** — list what was checked, what passed, what couldn't be reached
7. **Update this skill** — if a new blocker came up, append it to *Known
   blockers* below before finishing

If a step fails or can't be reached, **say so explicitly** and stop — do not
claim success on a partial verification.

## 1. Bring up the stack

```bash
# Check if dev server is already up before starting another one
curl -sf http://localhost:3000 > /dev/null && echo "already up" || npm start
```

`npm start` is slow on first boot (Meteor build). Wait until
`http://localhost:3000` responds before driving the browser.

## 2. Authenticate

Dev-only auto-user seeded by `createTestData()` in `server/main.ts`:

- username: `admin`
- password: `admin`
- role: `admin` (`roles: true` — full access)

Drive the login form at `/` (the public landing routes through `Login.tsx`),
or send credentials via `Meteor.loginWithPassword` in a `preview_eval` call if
the UI flow isn't what you're testing.

## 3. State setup (only when needed)

The whole repo has one canonical state-reset hatch:

```javascript
await Meteor.callAsync('demoData.generate')
```

**Destructive** — `wipeAllCollections()` empties every collection before
reseeding (see CLAUDE.md → Demo Data Generation). Use it when:

- You need a known, repeatable starting state across a multi-step flow
- Existing data is too sparse / too messy to exercise the golden path
- The change touches reference collections (ranks, squads, event types…) whose
  FK targets must exist before you can seed dependent docs

Do **not** call it when:

- The user is mid-session with real local data (ask first)
- You only need to verify a small isolated edit

Skip state setup entirely if the change is verifiable against whatever's
currently in the DB.

## 4. Golden paths

Pick the path that matches what changed. Each is the smallest sequence that
proves the feature still works end-to-end.

| Area | Path | DrawerStack form |
|------|------|------------------|
| Auth & shell | login → dashboard renders → header/nav present | — |
| Events | navigate `events` → calendar + table tabs render → create event via `EventForm` (rich-text description) → save → appears in calendar | `EventForm` |
| Event attendance | open an event → attendance tab → toggle a member's status → reload → state persisted | — |
| Tasks (Kanban) | navigate `tasks` → drag a task across columns → reload → column persisted | `TaskForm` |
| Members | navigate `members` → create member via `MemberForm` (nested `profile.X`) → save → appears in table | `MemberForm` |
| Squads | navigate `squads` → create squad → expand row → `SquadMembers` shows members | `SquadsForm` |
| ORBAT | navigate `orbat` → tree renders → switch view selector → no console errors | — |
| Roles | navigate `roles` → open role → toggle a permission in the matrix → save → reload → persisted | `RolesForm` |
| Questionnaires | create questionnaire with at least one question → assign to a member → log in as that member (or use My Questionnaires) → submit response | `QuestionnaireForm`, `QuestionnaireResponseForm` |
| Briefing templates | create template (rich text) → open `EventForm` → load template into description → tags survive sanitizer | `BriefingTemplatesForm` |
| Registration | open `/` while logged out → submit `RegistrationForm` → appears in `registrations` section | `RegistrationForm` |
| Settings / backup | navigate `settings` → toggle a setting → reload → persisted; `backup` → export round-trip | — |
| Palette | press `Cmd/Ctrl+K` → palette opens → fuzzy search finds a known nav target → Enter navigates | — |
| Drawer stack | open any entity form → from inside, open a `CollectionSelect` → use inline create → returns to parent with new value selected | — |
| i18n | switch language in header → labels change → reload → persisted | — |

Full surface index lives in [`docs/views-and-forms.md`](../../docs/views-and-forms.md);
consult it for less-common forms.

## 5. Proving it works

- **Screenshot before/after** the change you care about (Chrome MCP
  `preview_screenshot` or equivalent)
- **Console errors** — check the browser console for new errors that weren't
  there before
- **Audit log** — for any mutation, the `logs` collection should have a fresh
  `<collection>.<op>` entry (see [`/logs`](logs.md)). Absence is a red flag
- **DB state** — for state-changing flows, read the collection through Meteor
  shell or a `preview_eval` to confirm the expected document shape

## 6. Reporting

Output template:

```
## Verification: <area>

### Setup
- Dev server: <already up | started>
- State: <existing | reset via demoData.generate>
- User: admin

### Steps
1. <action> → <observed result>
2. ...

### Evidence
- Screenshot before: <path>
- Screenshot after: <path>
- Log entry: <action> @ <timestamp>

### Result: <PASS / FAIL / PARTIAL>
<If PARTIAL or FAIL: what couldn't be reached, what's still unknown>
```

## Known blockers

Append new entries here whenever you hit a fresh blocker — this skill is meant
to grow.

- **Rich-text fields lose tags** — only the allow-list in
  `imports/api/htmlSanitizer/sanitizePolicy.ts` survives. If a paste-from-Word
  flow drops formatting, that's expected, not a regression
- **Drawer state on close** — `useConfirmClose` runs only on user-initiated
  close (X / mask). `resolve` / `cancel` from inside the form skip it, so
  scripted closes won't trigger the unsaved-changes prompt
- **First `npm start` is slow** — Meteor rebuilds on cold start. Don't time
  out the browser drive until the server actually responds on port 3000
