# Responsive & Mobile Audit

Snapshot of the codebase's current responsive behavior, taken on branch
`feature/responsive-mobile-views` (2026-05-24), as the baseline for mobile work.
Findings are rated **P0** (functionally broken on mobile), **P1** (usable but
poor), **P2** (polish / smell).

> Companion map of every screen: [`docs/views-and-forms.md`](views-and-forms.md).

## TL;DR

The PWA foundation is sound — correct viewport meta, web-app-capable tags, a
manifest, and a 360px floor. The problem is **layout assumptions**, not
rendering: a handful of widgets read `window.innerWidth` once (non-reactive),
data tables have no horizontal-scroll escape hatch, and most forms/cards use
fixed `span` rather than responsive breakpoints. The chrome (header / footer /
nav) is already partly adaptive and the Kanban board is a good reference for
"done right."

---

## What already works (keep / use as reference)

- **Viewport & PWA meta** — `client/main.html` has `width=device-width,initial-scale=1`,
  `apple-mobile-web-app-capable`, `mobile-web-app-capable`, and a manifest. No change needed.
- **`Grid.useBreakpoint()` is the established hook** — reactive, used in
  `Header`, `Footer`, `Navigation`, `KanbanBoard`. This is the pattern to extend, not CSS media queries.
- **Navigation is mobile-friendly** — `navigation/Navigation.tsx` renders a
  `Dropdown` menu (hamburger `MenuOutlined`), collapsing the label below `sm`. No desktop-only sidebar to retrofit.
- **Chrome adapts at the edges** — `Header` hides the community `Title` below `lg`;
  `Footer` hides the avatar below `sm`.
- **KanbanBoard is fully responsive** — `tasks/KanbanBoard.tsx:51` ramps column
  span `6 → 8 → 12 → 24` across `xxl/lg/md/(mobile)`. **Use as the template** for other multi-column views.
- **Drawers go full-width on phones** — `getDrawerWidth()` (`imports/config.ts`)
  returns `windowWidth` below the 768px `MOBILE` breakpoint, otherwise 33%.
- **Responsive Col spans already in** `Dashboard`, `Settings`, `Backup`,
  `MemberProfile`, `MembersSquadView`, `MyQuestionnaires`, `Logs` (the 7 files using `xs/sm/md` props).

---

## Findings

### P0 — functionally broken on mobile

**1. Data tables have no horizontal-scroll escape hatch.**
`table/Table.tsx` renders `<AntdTable>` with **no `scroll={{ x }}`** prop, and
the `.table-container` class in `TableContainer.tsx` has **no matching CSS rule**
(grep `client/main.css` — absent). On a narrow viewport, Ant Design crushes
columns instead of scrolling, making every multi-column `Section` view (all 15
CRUD sections + the custom `Logs` table) unreadable. This is the single
highest-impact fix and touches one shared component.
- Files: `imports/ui/table/Table.tsx`, `imports/ui/table/body/TableContainer.tsx`, `client/main.css`
- Likely fix: add `scroll={{ x: 'max-content' }}` to the shared `Table`, and/or define column responsibility per `columns.tsx` factory.

### P1 — usable but poor

**2. `window.innerWidth` is read non-reactively in three places.**
No `resize`/`orientationchange` listener exists anywhere (only a
`prefers-color-scheme` listener in `App.tsx`). These read width once at
render and never update on rotation or window resize:
- `main/Main.tsx:76` — `isDeviceUnsupported(window.innerWidth)` device gate
- `drawer-stack/DrawerStackProvider.tsx:90` — `getDrawerWidth(window.innerWidth)`
- `members/ProfileModal.tsx:21` — `getModalWidth(window.innerWidth)`
- Likely fix: a small `useViewportWidth()` hook (debounced resize listener), or lean on `Grid.useBreakpoint()` + CSS where possible.

**3. The device gate blocks <360px but nothing is *designed* for 360–768px.**
`isDeviceUnsupported` (`imports/config.ts`) returns the "406 – Not supported"
screen only below `MIN_SUPPORTED_WIDTH = 360`. So phones in the 360–768 band
render the full desktop layout. That band is the real target of this work — the
gate is fine, the layouts behind it are not.

**4. `ProfileModal` width is not mobile-tuned.**
`getModalWidth()` always returns `75%` of viewport width regardless of size, and
isn't reactive (finding #2). On a phone a 75%-width centered modal with desktop
content is cramped. Consider full-screen modal below `MOBILE`.
- File: `imports/ui/members/ProfileModal.tsx`, `imports/config.ts`

**5. Forms and several layouts use fixed `span={N}`, not responsive props.**
Only 7 files use `xs/sm/md` Col props. Fixed-span layouts that will want
breakpoints: `MemberForm` (3), `RegistrationForm` (2), `CollectionSelect` (3),
`EventDetailPopover` (2), `Login` (2). Most drawer forms are vertical
single-column (fine), but multi-column form rows and `EventDetailPopover` need review.

**6. Heavy third-party views need a dedicated mobile story.**
- **`EventCalendar`** (`react-big-calendar`) — month/week grids are dense; the
  `.rbc-*` overrides in `client/main.css` are color-only, no responsive sizing.
  Consider defaulting to agenda/day view below `MOBILE`.
- **`Orbat`** (`react-organizational-chart`) — an org tree is intrinsically wide
  and has no scroll container; needs pan/zoom or horizontal scroll on mobile.

### P2 — polish / smells

**7. Orientation media query on `.app` is likely vestigial.**
`client/main.css:39-49` flips `.app { flex-direction }` between
`column`/`column-reverse` by orientation. But `.app` (the `AntdApp` wrapper in
`App.tsx`) now contains a single `<Layout>` plus `DemoTour`/`Palette` — the
header/main/footer order is owned by `<Layout>`, not `.app`. This rule probably
does nothing now; verify and delete, or it'll mislead future work.

**8. Logo sizing uses viewport units** (`5vh`/`20vh` in `client/main.css`) — fine,
but worth confirming it doesn't get tiny in landscape phones.

**9. `TableHeader` row** (`search` + `extra` + `create` button) uses `flex="auto"`
search with inline cols — verify wrap behavior on narrow screens (button may crowd search).

---

## Suggested sequencing

1. **#1 tables** — biggest win, one shared component, unblocks every Section view.
2. **#2 reactive viewport** — add the hook; fixes drawers/modal/gate reacting to rotation.
3. **#4 + #5** — modal full-screen on mobile + audit fixed-span form rows.
4. **#6 calendar/orbat** — per-view mobile modes (largest individual efforts).
5. **#7 cleanup** — confirm & remove the dead orientation rule.

Breakpoints to standardize on (already in `imports/config.ts`):
`MIN_SUPPORTED_WIDTH = 360`, `MOBILE = 768`. Ant's `Grid` breakpoints
(`xs<576, sm≥576, md≥768, lg≥992, xl≥1200, xxl≥1600`) are what `useBreakpoint`
exposes — note `MOBILE (768)` aligns with Ant's `md`.
