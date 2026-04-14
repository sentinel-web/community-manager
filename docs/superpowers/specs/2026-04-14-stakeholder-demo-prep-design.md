# Stakeholder Demo Preparation - Design Spec

## Context

Preparing for a casual screen-share walkthrough with a potential community leader who currently manages their ArmA III community using sophisticated Google Sheets. The goal is to show them how Community Manager replaces and improves upon their spreadsheet workflows.

## Deliverables

### 1. Generate Demo Data Button (Settings Page)

A development-only feature that populates the database with realistic demo data for demonstrations.

**Location:** Settings page, only visible when `NODE_ENV !== 'production'`

**Behavior:**
1. User clicks "Generate Demo Data" button
2. Confirmation dialog appears: "This will delete all existing data and replace it with demo data. Continue?"
3. On confirm: wipe all collections, then populate fresh demo data
4. Clean slate each time - no idempotency needed, always produces a consistent demo state

**Demo data to generate:**

| Collection | Count | Details |
|---|---|---|
| Members | 8-12 | Realistic military callsigns/names, spread across squads, various ranks and specializations |
| Squads | 3-4 | e.g., Alpha, Bravo, Charlie, HQ/Command. Colors, radio frequencies, parent-child hierarchy |
| Ranks | 5-6 | Progression chain: Recruit -> Private -> Corporal -> Sergeant -> Lieutenant -> Captain |
| Specializations | 4-5 | e.g., Medic, Marksman, Engineer, Pilot, Explosives |
| Medals | 3-4 | e.g., Service Medal, Combat Medal, Leadership Medal |
| Events | 5-8 | Mix of past and upcoming, different event types. Past events should have attendance data |
| Event Types | 3-4 | e.g., Training, Operation, Briefing, Social |
| Attendances | — | Attendance records for past events with realistic status distribution |
| Tasks | 6-8 | Spread across Kanban columns (To Do, In Progress, Done) |
| Task Statuses | 3 | To Do, In Progress, Done |
| Questionnaires | 1 | Active questionnaire with multiple question types |
| Questionnaire Responses | 3-5 | Responses to the active questionnaire |
| Registrations | 2-3 | Pending applications |
| Discovery Types | 3 | e.g., Reddit, Friend, Steam |
| Roles | 2-3 | Admin (existing), Officer (full CRUD), Member (read-only most modules) |

**Implementation approach:**
- Server method `settings.generateDemoData` (dev-only, guarded by `NODE_ENV` check)
- Wipes all collections first (except preserving the admin role/user, or recreating them as part of the demo data)
- Inserts demo data in dependency order: ranks/squads first, then members referencing them, then events, etc.
- Client-side button in Settings page with Ant Design Popconfirm for the confirmation dialog

### 2. Demo Walkthrough Cheat Sheet

A markdown file with the tour order, talking points, and prepared answers to common questions.

**Location:** `docs/demo-walkthrough-guide.md`

**Contents:**

#### Tour Flow (~20-30 min)

1. **Dashboard** (1 min) - First impression, collection statistics
2. **Members** (3 min) - Table view, search, expandable profiles, profile details
3. **Squads & ORBAT** (3 min) - Squad management, then ORBAT chart (simple + advanced view) - *wow moment*
4. **Ranks, Specializations, Medals** (2 min) - Progression system, prerequisites
5. **Events & Calendar** (3 min) - Calendar view with color-coded events, drag to reschedule - *wow moment*
6. **Attendance** (2 min) - Attendance matrix, color-coded status tags - *wow moment: "one click vs cross-referencing spreadsheet tabs"*
7. **Tasks & Kanban** (2 min) - Drag-and-drop between columns - *wow moment*
8. **Questionnaires** (2 min) - Create/manage surveys, view responses
9. **Registrations** (1 min) - Recruitment pipeline
10. **Roles & Permissions** (2 min) - Show admin vs member role side-by-side in two browser tabs - *wow moment*
11. **Settings, Logs, Backup** (2 min) - Community branding, audit trail, one-click backup download - *wow moment*
12. **Theme + Language** (1 min) - Toggle dark/light, switch language - polish moment

#### Before the Call Checklist

- [ ] Run `npm start`, verify app loads at localhost:3000
- [ ] Click "Generate Demo Data" in Settings
- [ ] Verify data looks good across all sections
- [ ] Open second browser/incognito logged in as "Member" role user
- [ ] Set theme to light mode, language to English
- [ ] Verify calendar has events near current week

#### Prepared Answers

| Question | Answer |
|---|---|
| Can my members access this? | Yes, role-based access - each member gets a login with permissions matching their role |
| Where is the data stored? | MongoDB, self-hosted via Docker - you own your data completely |
| Does it work on mobile? | Ant Design is responsive - resize browser to demonstrate |
| How do I get started? | Single `docker compose up -d` command, or I can help set up |
| Can multiple people use it simultaneously? | Yes, Meteor provides real-time reactivity - changes sync instantly across all users |
| What languages are supported? | English, German, and French. More can be added. |

#### Tips

- Keep it conversational, let them ask questions as you go
- Offer "Want me to show you anything specific?" midway through
- If they ask about a missing feature, be honest and note it as future potential
- Skip Logs if they seem disengaged with admin features
- The ORBAT chart and calendar are the strongest visual differentiators vs spreadsheets
