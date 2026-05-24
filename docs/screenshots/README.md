# View Screenshots

Captured on branch `feature/responsive-mobile-views` (2026-05-24) against the
dev server with the full demo dataset, via `scripts/capture-views.mjs`.

- **Desktop** — 1440×900 viewport
- **Mobile** — 375×812 viewport (iPhone-class), *after* the table→list change
- **Mobile (before)** — the same views before the change, when data tables
  collapsed/crushed at 375px (the [responsive audit](../responsive-audit.md)
  finding **#1**, P0). Kept under `mobile-before/` for comparison.

On mobile, the shared `Table` component (`imports/ui/table/Table.tsx`) now
renders below the `md` (768px) breakpoint as a card **list** (`TableList`)
instead of an Ant Design table, reusing each column's own `title`/`render`.
This covers every `Section` view and the custom Logs table at once.

To regenerate: ensure the dev server is up with demo data, then
`node scripts/capture-views.mjs` (writes to `/tmp/cm-shots`, copy into place).

| # | View | Desktop | Mobile | Mobile (before) |
|---|------|---------|--------|-----------------|
| 01 | `dashboard` | [desktop](desktop/01-dashboard.png) | [mobile](mobile/01-dashboard.png) | [before](mobile-before/01-dashboard.png) |
| 02 | `orbat` | [desktop](desktop/02-orbat.png) | [mobile](mobile/02-orbat.png) | [before](mobile-before/02-orbat.png) |
| 03 | `events` | [desktop](desktop/03-events.png) | [mobile](mobile/03-events.png) | [before](mobile-before/03-events.png) |
| 04 | `eventTypes` | [desktop](desktop/04-eventTypes.png) | [mobile](mobile/04-eventTypes.png) | [before](mobile-before/04-eventTypes.png) |
| 05 | `briefingTemplates` | [desktop](desktop/05-briefingTemplates.png) | [mobile](mobile/05-briefingTemplates.png) | [before](mobile-before/05-briefingTemplates.png) |
| 06 | `tasks` | [desktop](desktop/06-tasks.png) | [mobile](mobile/06-tasks.png) | [before](mobile-before/06-tasks.png) |
| 07 | `taskStatus` | [desktop](desktop/07-taskStatus.png) | [mobile](mobile/07-taskStatus.png) | [before](mobile-before/07-taskStatus.png) |
| 08 | `squads` | [desktop](desktop/08-squads.png) | [mobile](mobile/08-squads.png) | [before](mobile-before/08-squads.png) |
| 09 | `members` | [desktop](desktop/09-members.png) | [mobile](mobile/09-members.png) | [before](mobile-before/09-members.png) |
| 10 | `ranks` | [desktop](desktop/10-ranks.png) | [mobile](mobile/10-ranks.png) | [before](mobile-before/10-ranks.png) |
| 11 | `specializations` | [desktop](desktop/11-specializations.png) | [mobile](mobile/11-specializations.png) | [before](mobile-before/11-specializations.png) |
| 12 | `medals` | [desktop](desktop/12-medals.png) | [mobile](mobile/12-medals.png) | [before](mobile-before/12-medals.png) |
| 13 | `positions` | [desktop](desktop/13-positions.png) | [mobile](mobile/13-positions.png) | [before](mobile-before/13-positions.png) |
| 14 | `registrations` | [desktop](desktop/14-registrations.png) | [mobile](mobile/14-registrations.png) | [before](mobile-before/14-registrations.png) |
| 15 | `discoveryTypes` | [desktop](desktop/15-discoveryTypes.png) | [mobile](mobile/15-discoveryTypes.png) | [before](mobile-before/15-discoveryTypes.png) |
| 16 | `roles` | [desktop](desktop/16-roles.png) | [mobile](mobile/16-roles.png) | [before](mobile-before/16-roles.png) |
| 17 | `questionnaires` | [desktop](desktop/17-questionnaires.png) | [mobile](mobile/17-questionnaires.png) | [before](mobile-before/17-questionnaires.png) |
| 18 | `myQuestionnaires` | [desktop](desktop/18-myQuestionnaires.png) | [mobile](mobile/18-myQuestionnaires.png) | [before](mobile-before/18-myQuestionnaires.png) |
| 19 | `logs` | [desktop](desktop/19-logs.png) | [mobile](mobile/19-logs.png) | [before](mobile-before/19-logs.png) |
| 20 | `settings` | [desktop](desktop/20-settings.png) | [mobile](mobile/20-settings.png) | [before](mobile-before/20-settings.png) |
| 21 | `backup` | [desktop](desktop/21-backup.png) | [mobile](mobile/21-backup.png) | [before](mobile-before/21-backup.png) |
