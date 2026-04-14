# Demo Walkthrough Guide

## Tour Flow (~20-30 min)

1. **Dashboard** (1 min) - First impression, collection statistics
2. **Members** (3 min) - Table view, search, expandable profiles, profile details
3. **Squads & ORBAT** (3 min) - Squad management, then ORBAT chart (simple + advanced view)
4. **Ranks, Specializations, Medals** (2 min) - Progression system, prerequisites
5. **Events & Calendar** (3 min) - Calendar view with color-coded events, drag to reschedule
6. **Attendance** (2 min) - Attendance matrix, color-coded status tags ("one click vs cross-referencing spreadsheet tabs")
7. **Tasks & Kanban** (2 min) - Drag-and-drop between columns
8. **Questionnaires** (2 min) - Create/manage surveys, view responses
9. **Registrations** (1 min) - Recruitment pipeline
10. **Roles & Permissions** (2 min) - Show admin vs member role side-by-side in two browser tabs
11. **Settings, Logs, Backup** (2 min) - Community branding, audit trail, one-click backup download
12. **Theme + Language** (1 min) - Toggle dark/light, switch language

## Before the Call Checklist

- Run `npm start`, verify app loads at localhost:3000
- Click "Generate Demo Data" in Settings
- Verify data looks good across all sections
- Open second browser/incognito logged in as "Member" role user (ghost/demo)
- Set theme to light mode, language to English
- Verify calendar has events near current week

## Prepared Answers

| Question | Answer |
|---|---|
| Can my members access this? | Yes, role-based access - each member gets a login with permissions matching their role |
| Where is the data stored? | MongoDB, self-hosted via Docker - you own your data completely |
| Does it work on mobile? | Ant Design is responsive - resize browser to demonstrate |
| How do I get started? | Single `docker compose up -d` command, or I can help set up |
| Can multiple people use it simultaneously? | Yes, Meteor provides real-time reactivity - changes sync instantly across all users |
| What languages are supported? | English, German, and French. More can be added. |

## Tips

- Keep it conversational, let them ask questions as you go
- Offer "Want me to show you anything specific?" midway through
- If they ask about a missing feature, be honest and note it as future potential
- Skip Logs if they seem disengaged with admin features
- The ORBAT chart and calendar are the strongest visual differentiators vs spreadsheets
