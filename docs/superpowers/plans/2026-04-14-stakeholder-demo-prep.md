# Stakeholder Demo Preparation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generate Demo Data" button to the Settings page (dev-only) that wipes all collections and populates realistic demo data for stakeholder demos, plus a walkthrough cheat sheet.

**Architecture:** A single server method `demoData.generate` in `server/apis/demoData.server.js` handles the wipe-and-populate logic. The Settings page gets a new `DemoDataSettings` component (dev-only) with a Popconfirm button that calls this method. Demo data is defined as plain arrays of objects, inserted in dependency order (roles/ranks/squads first, then members, then events/tasks/etc.). The walkthrough guide is a standalone markdown file.

**Tech Stack:** Meteor 3.4+, React 18, Ant Design, MongoDB

---

## Chunk 1: Server Method and Demo Data

### Task 1: Create demo data server method with collection wipe

**Files:**
- Create: `server/apis/demoData.server.js`
- Modify: `server/main.js` (add import)

- [ ] **Step 1: Create `server/apis/demoData.server.js` with the method skeleton**

```javascript
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import DiscoveryTypesCollection from '../../imports/api/collections/discoveryTypes.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';
import LogsCollection from '../../imports/api/collections/logs.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import ProfilePicturesCollection from '../../imports/api/collections/profilePictures.collection';
import QuestionnairesCollection from '../../imports/api/collections/questionnaires.collection';
import QuestionnaireResponsesCollection from '../../imports/api/collections/questionnaireResponses.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import TaskStatusCollection from '../../imports/api/collections/taskStatus.collection';
import { validateUserId, checkPermission } from '../main';
import { createLog } from './logs.server';

async function wipeAllCollections() {
  await AttendancesCollection.removeAsync({});
  await DiscoveryTypesCollection.removeAsync({});
  await EventsCollection.removeAsync({});
  await EventTypesCollection.removeAsync({});
  await LogsCollection.removeAsync({});
  await MedalsCollection.removeAsync({});
  await MembersCollection.removeAsync({});
  await PositionsCollection.removeAsync({});
  await ProfilePicturesCollection.removeAsync({});
  await QuestionnairesCollection.removeAsync({});
  await QuestionnaireResponsesCollection.removeAsync({});
  await RanksCollection.removeAsync({});
  await RegistrationsCollection.removeAsync({});
  await RolesCollection.removeAsync({});
  await SettingsCollection.removeAsync({});
  await SpecializationsCollection.removeAsync({});
  await SquadsCollection.removeAsync({});
  await TasksCollection.removeAsync({});
  await TaskStatusCollection.removeAsync({});
}

if (Meteor.isServer) {
  Meteor.methods({
    'demoData.generate': async function () {
      if (process.env.NODE_ENV === 'production') {
        throw new Meteor.Error(403, 'Demo data generation is not available in production');
      }
      validateUserId(this.userId);
      const hasPermission = await checkPermission(this.userId, 'settings');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      await wipeAllCollections();
      await insertDemoData();
      await createLog('demoData.generated', {});
      return true;
    },
  });
}
```

The `insertDemoData()` function will be defined in the next steps.

- [ ] **Step 2: Add demo data definition arrays**

Add after `wipeAllCollections()`, before the `Meteor.methods` block. All IDs use descriptive strings for readability and cross-referencing.

```javascript
// === Demo Data Definitions ===

const ROLES = [
  { _id: 'admin', name: 'Admin', color: '#f5222d', roles: true },
  {
    _id: 'officer',
    name: 'Officer',
    color: '#1890ff',
    dashboard: true,
    orbat: true,
    logs: true,
    settings: true,
    members: { read: true, create: true, update: true, delete: true },
    events: { read: true, create: true, update: true, delete: true },
    tasks: { read: true, create: true, update: true, delete: true },
    squads: { read: true, create: true, update: true, delete: true },
    ranks: { read: true, create: true, update: true, delete: true },
    specializations: { read: true, create: true, update: true, delete: true },
    medals: { read: true, create: true, update: true, delete: true },
    eventTypes: { read: true, create: true, update: true, delete: true },
    taskStatus: { read: true, create: true, update: true, delete: true },
    registrations: { read: true, create: true, update: true, delete: true },
    discoveryTypes: { read: true, create: true, update: true, delete: true },
    roles: { read: true, create: false, update: false, delete: false },
    questionnaires: { read: true, create: true, update: true, delete: true },
    positions: { read: true, create: true, update: true, delete: true },
  },
  {
    _id: 'member',
    name: 'Member',
    color: '#52c41a',
    dashboard: true,
    orbat: true,
    logs: false,
    settings: false,
    members: { read: true, create: false, update: false, delete: false },
    events: { read: true, create: false, update: false, delete: false },
    tasks: { read: true, create: true, update: true, delete: false },
    squads: { read: true, create: false, update: false, delete: false },
    ranks: { read: true, create: false, update: false, delete: false },
    specializations: { read: true, create: false, update: false, delete: false },
    medals: { read: true, create: false, update: false, delete: false },
    eventTypes: { read: true, create: false, update: false, delete: false },
    taskStatus: { read: true, create: false, update: false, delete: false },
    registrations: { read: false, create: false, update: false, delete: false },
    discoveryTypes: { read: false, create: false, update: false, delete: false },
    roles: { read: false, create: false, update: false, delete: false },
    questionnaires: { read: true, create: false, update: false, delete: false },
    positions: { read: true, create: false, update: false, delete: false },
  },
];

const SQUADS = [
  { _id: 'hq', name: 'HQ Command', color: '#f5222d', shortRangeFrequency: '100.0', longRangeFrequency: '50.0', description: 'Headquarters and command staff' },
  { _id: 'alpha', name: 'Alpha', color: '#1890ff', parentSquadId: 'hq', shortRangeFrequency: '110.0', longRangeFrequency: '50.0', description: 'Primary assault element' },
  { _id: 'bravo', name: 'Bravo', color: '#52c41a', parentSquadId: 'hq', shortRangeFrequency: '120.0', longRangeFrequency: '50.0', description: 'Fire support element' },
  { _id: 'charlie', name: 'Charlie', color: '#faad14', parentSquadId: 'hq', shortRangeFrequency: '130.0', longRangeFrequency: '50.0', description: 'Reconnaissance and special operations' },
];

const RANKS = [
  { _id: 'recruit', name: 'Recruit', type: 'player', color: '#8c8c8c', nextRankId: 'private', description: 'New community member in training' },
  { _id: 'private', name: 'Private', type: 'player', color: '#52c41a', previousRankId: 'recruit', nextRankId: 'corporal', description: 'Standard member rank' },
  { _id: 'corporal', name: 'Corporal', type: 'player', color: '#1890ff', previousRankId: 'private', nextRankId: 'sergeant', description: 'Experienced member, may lead fireteams' },
  { _id: 'sergeant', name: 'Sergeant', type: 'player', color: '#722ed1', previousRankId: 'corporal', nextRankId: 'lieutenant', description: 'Squad-level leadership' },
  { _id: 'lieutenant', name: 'Lieutenant', type: 'player', color: '#fa8c16', previousRankId: 'sergeant', nextRankId: 'captain', description: 'Platoon-level command' },
  { _id: 'captain', name: 'Captain', type: 'player', color: '#f5222d', previousRankId: 'lieutenant', description: 'Senior command' },
];

const SPECIALIZATIONS = [
  { _id: 'medic', name: 'Medic', color: '#f5222d', description: 'Trained in combat medical procedures' },
  { _id: 'marksman', name: 'Marksman', color: '#1890ff', description: 'Precision shooting specialist' },
  { _id: 'engineer', name: 'Engineer', color: '#faad14', description: 'Explosives and fortification specialist' },
  { _id: 'pilot', name: 'Pilot', color: '#52c41a', requiredRankId: 'corporal', description: 'Rotary and fixed-wing aircraft operator' },
  { _id: 'jtac', name: 'JTAC', color: '#722ed1', requiredRankId: 'sergeant', requiredSpecializations: ['marksman'], description: 'Joint Terminal Attack Controller' },
];

const MEDALS = [
  { _id: 'service', name: 'Service Medal', color: '#1890ff', description: 'Awarded for 6 months of active service' },
  { _id: 'combat', name: 'Combat Excellence', color: '#f5222d', description: 'Awarded for outstanding performance in operations' },
  { _id: 'leadership', name: 'Leadership Medal', color: '#faad14', description: 'Awarded for exceptional leadership' },
  { _id: 'instructor', name: 'Instructor Badge', color: '#52c41a', description: 'Awarded for training contributions' },
];

const POSITIONS = [
  { _id: 'squad-leader', name: 'Squad Leader', color: '#f5222d', description: 'Leads a squad in operations' },
  { _id: 'fireteam-lead', name: 'Fireteam Lead', color: '#fa8c16', description: 'Leads a fireteam within a squad' },
  { _id: 'logistics', name: 'Logistics Officer', color: '#1890ff', description: 'Manages equipment and supply operations' },
];

const DISCOVERY_TYPES = [
  { _id: 'reddit', name: 'Reddit', color: '#ff4500', description: 'Found via Reddit communities' },
  { _id: 'friend', name: 'Friend Referral', color: '#52c41a', description: 'Referred by an existing member' },
  { _id: 'steam', name: 'Steam', color: '#171a21', description: 'Found via Steam groups or forums' },
];

const EVENT_TYPES = [
  { _id: 'training', name: 'Training', color: '#1890ff', description: 'Skill-building and practice sessions' },
  { _id: 'operation', name: 'Operation', color: '#f5222d', description: 'Full-scale military operations' },
  { _id: 'briefing', name: 'Briefing', color: '#faad14', description: 'Mission planning and information sessions' },
  { _id: 'social', name: 'Social', color: '#52c41a', description: 'Community social events and game nights' },
];

const TASK_STATUSES = [
  { _id: 'todo', name: 'To Do', color: '#8c8c8c', description: 'Tasks waiting to be started' },
  { _id: 'in-progress', name: 'In Progress', color: '#1890ff', description: 'Tasks currently being worked on' },
  { _id: 'done', name: 'Done', color: '#52c41a', description: 'Completed tasks' },
];

// Members are created via Accounts.createUserAsync, so just define profile data.
// The admin user gets 'admin'/'admin' credentials for demo login.
const MEMBERS = [
  { username: 'admin', password: 'admin', profile: { name: 'Admin', id: 1000, roleId: 'admin', squadId: 'hq', rankId: 'captain', specializationIds: [], medalIds: ['leadership', 'service'], description: 'Community administrator', entryDate: new Date('2024-01-15') } },
  { username: 'viper', password: 'demo', profile: { name: 'Viper', id: 1001, roleId: 'officer', squadId: 'alpha', rankId: 'lieutenant', specializationIds: ['marksman', 'jtac'], medalIds: ['combat', 'service'], description: 'Alpha squad leader', entryDate: new Date('2024-03-10') } },
  { username: 'doc', password: 'demo', profile: { name: 'Doc', id: 1002, roleId: 'officer', squadId: 'bravo', rankId: 'sergeant', specializationIds: ['medic'], medalIds: ['service'], description: 'Bravo squad medic and leader', entryDate: new Date('2024-05-22') } },
  { username: 'ghost', password: 'demo', profile: { name: 'Ghost', id: 1003, roleId: 'member', squadId: 'charlie', rankId: 'sergeant', specializationIds: ['marksman'], medalIds: ['combat'], description: 'Recon specialist', entryDate: new Date('2024-06-01') } },
  { username: 'hammer', password: 'demo', profile: { name: 'Hammer', id: 1004, roleId: 'member', squadId: 'alpha', rankId: 'corporal', specializationIds: ['engineer'], medalIds: [], description: 'Demolitions expert', entryDate: new Date('2024-08-15') } },
  { username: 'phoenix', password: 'demo', profile: { name: 'Phoenix', id: 1005, roleId: 'member', squadId: 'bravo', rankId: 'corporal', specializationIds: ['pilot'], medalIds: ['instructor'], description: 'Rotary wing pilot', entryDate: new Date('2024-09-03') } },
  { username: 'frost', password: 'demo', profile: { name: 'Frost', id: 1006, roleId: 'member', squadId: 'charlie', rankId: 'private', specializationIds: ['medic'], medalIds: [], description: 'Field medic in training', entryDate: new Date('2025-01-10') } },
  { username: 'blaze', password: 'demo', profile: { name: 'Blaze', id: 1007, roleId: 'member', squadId: 'alpha', rankId: 'private', specializationIds: [], medalIds: [], description: 'New assault team member', entryDate: new Date('2025-03-20') } },
  { username: 'raven', password: 'demo', profile: { name: 'Raven', id: 1008, roleId: 'member', squadId: 'bravo', rankId: 'private', specializationIds: [], medalIds: [], description: 'Support gunner', entryDate: new Date('2025-06-15') } },
  { username: 'wolf', password: 'demo', profile: { name: 'Wolf', id: 1009, roleId: 'member', squadId: 'charlie', rankId: 'recruit', specializationIds: [], medalIds: [], description: 'Recently joined, completing basic training', entryDate: new Date('2026-02-01') } },
];

// Events use dates relative to "now" so the calendar always looks current.
function createEvents() {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  return [
    { _id: 'evt-1', name: 'Basic Infantry Training', start: new Date(now - 14 * day), end: new Date(now - 14 * day + 3 * 60 * 60 * 1000), eventType: 'training', hosts: [], attendees: [], description: 'Fundamentals of infantry tactics' },
    { _id: 'evt-2', name: 'Operation Thunderstrike', start: new Date(now - 7 * day), end: new Date(now - 7 * day + 4 * 60 * 60 * 1000), eventType: 'operation', hosts: [], attendees: [], color: '#f5222d', description: 'Large-scale combined arms operation' },
    { _id: 'evt-3', name: 'Marksman Qualification', start: new Date(now - 3 * day), end: new Date(now - 3 * day + 2 * 60 * 60 * 1000), eventType: 'training', hosts: [], attendees: [], description: 'Marksmanship certification course' },
    { _id: 'evt-4', name: 'Weekly Briefing', start: new Date(now + 1 * day), end: new Date(now + 1 * day + 1 * 60 * 60 * 1000), eventType: 'briefing', hosts: [], attendees: [], description: 'Weekly community status update' },
    { _id: 'evt-5', name: 'Operation Nightfall', start: new Date(now + 4 * day), end: new Date(now + 4 * day + 4 * 60 * 60 * 1000), eventType: 'operation', hosts: [], attendees: [], color: '#722ed1', description: 'Night operations training exercise' },
    { _id: 'evt-6', name: 'Game Night', start: new Date(now + 7 * day), end: new Date(now + 7 * day + 3 * 60 * 60 * 1000), eventType: 'social', hosts: [], attendees: [], description: 'Casual gaming and community bonding' },
    { _id: 'evt-7', name: 'Advanced CQB Training', start: new Date(now + 10 * day), end: new Date(now + 10 * day + 2 * 60 * 60 * 1000), eventType: 'training', hosts: [], attendees: [], description: 'Close quarters battle techniques' },
  ];
}

// Attendances for past events. Schema: one doc per event, member IDs as keys with point values.
// Points: -2 cancelled, -1 absent, 0 excused, 1 present, 2 zeus
function createAttendances(memberIds) {
  return [
    { _id: 'att-1', eventId: 'evt-1', [memberIds[0]]: 2, [memberIds[1]]: 1, [memberIds[2]]: 1, [memberIds[3]]: 1, [memberIds[4]]: 1, [memberIds[5]]: 0, [memberIds[6]]: -1, [memberIds[7]]: 1, [memberIds[8]]: 1 },
    { _id: 'att-2', eventId: 'evt-2', [memberIds[0]]: 2, [memberIds[1]]: 1, [memberIds[2]]: 1, [memberIds[3]]: 1, [memberIds[4]]: 1, [memberIds[5]]: 1, [memberIds[6]]: 1, [memberIds[7]]: -1, [memberIds[8]]: 0, [memberIds[9]]: -2 },
    { _id: 'att-3', eventId: 'evt-3', [memberIds[0]]: 0, [memberIds[1]]: 2, [memberIds[2]]: -1, [memberIds[3]]: 1, [memberIds[4]]: 1, [memberIds[5]]: 1, [memberIds[6]]: 1, [memberIds[7]]: 1, [memberIds[8]]: -2 },
  ];
}

function createTasks(memberIds) {
  return [
    { _id: 'task-1', name: 'Update server mods list', status: 'done', participants: [memberIds[1]], priority: 'high', description: 'Verify and update the required mod collection on Steam Workshop', createdAt: new Date() },
    { _id: 'task-2', name: 'Review new applications', status: 'in-progress', participants: [memberIds[2]], priority: 'medium', description: 'Process pending registration applications', createdAt: new Date() },
    { _id: 'task-3', name: 'Plan next operation', status: 'in-progress', participants: [memberIds[0], memberIds[1]], priority: 'high', description: 'Design mission briefing and objectives for Operation Nightfall', createdAt: new Date() },
    { _id: 'task-4', name: 'Fix TeamSpeak permissions', status: 'todo', participants: [memberIds[4]], priority: 'low', description: 'Update channel permissions for new squad structure', createdAt: new Date() },
    { _id: 'task-5', name: 'Create training curriculum', status: 'todo', participants: [memberIds[3]], priority: 'medium', description: 'Draft a structured training program for new recruits', createdAt: new Date() },
    { _id: 'task-6', name: 'Organize community awards', status: 'todo', participants: [memberIds[0]], priority: 'low', description: 'Prepare quarterly awards ceremony', createdAt: new Date() },
    { _id: 'task-7', name: 'Update ORBAT documentation', status: 'done', participants: [memberIds[1], memberIds[3]], priority: 'medium', description: 'Reflect recent squad reorganization in documentation', createdAt: new Date() },
  ];
}

const QUESTIONNAIRE = {
  _id: 'q-1',
  name: 'Monthly Community Feedback',
  description: 'Help us improve! Share your thoughts on recent events and community direction.',
  status: 'active',
  allowAnonymous: true,
  interval: 'monthly',
  questions: [
    { text: 'How would you rate the quality of recent operations?', type: 'rating', required: true, options: [] },
    { text: 'What type of events would you like to see more of?', type: 'select', required: true, options: ['Training', 'Operations', 'Social', 'Briefings'] },
    { text: 'Any suggestions or feedback for the leadership team?', type: 'textarea', required: false, options: [] },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createQuestionnaireResponses(memberIds) {
  return [
    {
      _id: 'qr-1', questionnaireId: 'q-1', respondentId: memberIds[3], submittedAt: new Date(), createdAt: new Date(),
      answers: [
        { questionIndex: 0, questionText: 'How would you rate the quality of recent operations?', questionType: 'rating', value: 4 },
        { questionIndex: 1, questionText: 'What type of events would you like to see more of?', questionType: 'select', value: 'Operations' },
        { questionIndex: 2, questionText: 'Any suggestions or feedback for the leadership team?', questionType: 'textarea', value: 'More night ops would be great!' },
      ],
    },
    {
      _id: 'qr-2', questionnaireId: 'q-1', respondentId: memberIds[5], submittedAt: new Date(), createdAt: new Date(),
      answers: [
        { questionIndex: 0, questionText: 'How would you rate the quality of recent operations?', questionType: 'rating', value: 5 },
        { questionIndex: 1, questionText: 'What type of events would you like to see more of?', questionType: 'select', value: 'Training' },
        { questionIndex: 2, questionText: 'Any suggestions or feedback for the leadership team?', questionType: 'textarea', value: 'Would love a dedicated pilot training program.' },
      ],
    },
    {
      _id: 'qr-3', questionnaireId: 'q-1', respondentId: null, submittedAt: new Date(), createdAt: new Date(),
      answers: [
        { questionIndex: 0, questionText: 'How would you rate the quality of recent operations?', questionType: 'rating', value: 3 },
        { questionIndex: 1, questionText: 'What type of events would you like to see more of?', questionType: 'select', value: 'Social' },
        { questionIndex: 2, questionText: 'Any suggestions or feedback for the leadership team?', questionType: 'textarea', value: '' },
      ],
    },
  ];
}

const REGISTRATIONS = [
  { _id: 'reg-1', name: 'Spartan', id: 2001, age: 22, discoveryType: 'reddit', rulesReadAndAccepted: true, description: 'Experienced ArmA player looking for a structured community. 500+ hours.' },
  { _id: 'reg-2', name: 'Echo', id: 2002, age: 19, discoveryType: 'friend', rulesReadAndAccepted: true, description: 'Referred by Ghost. Interested in recon operations.' },
  { _id: 'reg-3', name: 'Titan', id: 2003, age: 25, discoveryType: 'steam', rulesReadAndAccepted: true, description: 'Former milsim player, looking for an active group.' },
];

const SETTINGS = [
  { _id: 'community-title', key: 'community-title', value: 'Task Force Sentinel' },
  { _id: 'community-color', key: 'community-color', value: '#1890ff' },
];
```

- [ ] **Step 3: Add the `insertDemoData()` function**

Add this after the data definitions, before `Meteor.methods`:

```javascript
async function insertDemoData() {
  // 1. Reference data (no dependencies)
  for (const role of ROLES) await RolesCollection.insertAsync(role);
  for (const squad of SQUADS) await SquadsCollection.insertAsync(squad);
  for (const rank of RANKS) await RanksCollection.insertAsync(rank);
  for (const spec of SPECIALIZATIONS) await SpecializationsCollection.insertAsync(spec);
  for (const medal of MEDALS) await MedalsCollection.insertAsync(medal);
  for (const position of POSITIONS) await PositionsCollection.insertAsync(position);
  for (const dt of DISCOVERY_TYPES) await DiscoveryTypesCollection.insertAsync(dt);
  for (const et of EVENT_TYPES) await EventTypesCollection.insertAsync(et);
  for (const ts of TASK_STATUSES) await TaskStatusCollection.insertAsync(ts);

  // 2. Members (depend on roles, squads, ranks, specializations, medals)
  const memberIds = [];
  for (const member of MEMBERS) {
    const userId = await Accounts.createUserAsync({ username: member.username, password: member.password });
    await MembersCollection.updateAsync(userId, { $set: { profile: member.profile } });
    memberIds.push(userId);
  }

  // 3. Events (no member dependency for the documents themselves)
  const events = createEvents();
  for (const event of events) await EventsCollection.insertAsync(event);

  // 4. Attendances (depend on events and members)
  const attendances = createAttendances(memberIds);
  for (const att of attendances) await AttendancesCollection.insertAsync(att);

  // 5. Tasks (depend on members for participants)
  const tasks = createTasks(memberIds);
  for (const task of tasks) await TasksCollection.insertAsync(task);

  // 6. Questionnaires and responses
  await QuestionnairesCollection.insertAsync(QUESTIONNAIRE);
  const responses = createQuestionnaireResponses(memberIds);
  for (const resp of responses) await QuestionnaireResponsesCollection.insertAsync(resp);

  // 7. Registrations (standalone)
  for (const reg of REGISTRATIONS) await RegistrationsCollection.insertAsync(reg);

  // 8. Settings
  for (const setting of SETTINGS) await SettingsCollection.insertAsync(setting);
}
```

- [ ] **Step 4: Add the import to `server/main.js`**

Add this line in the API imports section (alphabetical order, between `./apis/dashboard.server` and `./apis/events.server`):

```javascript
import './apis/demoData.server';
```

- [ ] **Step 5: Verify the server starts without errors**

Run: `npm start`
Expected: Server starts cleanly, no import errors. The `demoData.generate` method is registered but not called automatically.

- [ ] **Step 6: Commit**

```bash
git add server/apis/demoData.server.js server/main.js
git commit -m "Add demoData.generate server method with realistic demo data"
```

---

### Task 2: Add Generate Demo Data button to Settings page

**Files:**
- Modify: `imports/ui/settings/Settings.jsx`
- Modify: `imports/i18n/locales/en.json`
- Modify: `imports/i18n/locales/de.json`
- Modify: `imports/i18n/locales/fr.json`

- [ ] **Step 1: Add i18n keys for the demo data button**

Add to the `"settings"` section of each locale file. Note: add a trailing comma after the existing `"enterBlacklistedId"` value before inserting these new keys.

**en.json** - add after `"enterBlacklistedId"` (add comma to existing line first):
```json
"generateDemoData": "Generate Demo Data",
"generateDemoDataConfirm": "This will delete all existing data and replace it with demo data. Continue?",
"generateDemoDataSuccess": "Demo data generated successfully. Please log in again.",
"generateDemoDataError": "Failed to generate demo data"
```

**de.json** - equivalent section:
```json
"generateDemoData": "Demodaten generieren",
"generateDemoDataConfirm": "Dies wird alle vorhandenen Daten l\u00f6schen und durch Demodaten ersetzen. Fortfahren?",
"generateDemoDataSuccess": "Demodaten erfolgreich generiert. Bitte erneut anmelden.",
"generateDemoDataError": "Demodaten konnten nicht generiert werden"
```

**fr.json** - equivalent section:
```json
"generateDemoData": "G\u00e9n\u00e9rer des donn\u00e9es de d\u00e9mo",
"generateDemoDataConfirm": "Ceci supprimera toutes les donn\u00e9es existantes et les remplacera par des donn\u00e9es de d\u00e9mo. Continuer ?",
"generateDemoDataSuccess": "Donn\u00e9es de d\u00e9mo g\u00e9n\u00e9r\u00e9es avec succ\u00e8s. Veuillez vous reconnecter.",
"generateDemoDataError": "\u00c9chec de la g\u00e9n\u00e9ration des donn\u00e9es de d\u00e9mo"
```

- [ ] **Step 2: Add the `DemoDataSettings` component to Settings.jsx**

Add a new component after the `CommunityColorSettings` component (after line 284) in `Settings.jsx`:

```javascript
function DemoDataSettings({ t }) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      await Meteor.callAsync('demoData.generate');
      alert(t('settings.generateDemoDataSuccess'));
      window.location.reload();
    } catch (error) {
      alert(t('settings.generateDemoDataError') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title={t('settings.generateDemoData')} />
      <Col span={24}>
        <Popconfirm
          title={t('settings.generateDemoDataConfirm')}
          onConfirm={handleGenerate}
          okText="OK"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button danger loading={loading}>
            {t('settings.generateDemoData')}
          </Button>
        </Popconfirm>
      </Col>
    </Row>
  );
}
DemoDataSettings.propTypes = {
  t: PropTypes.func,
};
```

- [ ] **Step 3: Add Popconfirm import and render the component conditionally**

At the top of `Settings.jsx`, add `Popconfirm` to the Ant Design import:

```javascript
import { Button, Col, ColorPicker, Input, List, Popconfirm, Row, Typography } from 'antd';
```

In the `Settings` component's return JSX, add after the `CommunityIdBlackListSettings` `</Col>` (after line 85), inside the existing `<Row gutter={[16, 16]}>`:

```jsx
{Meteor.isDevelopment && (
  <Col span={24}>
    <DemoDataSettings t={t} />
  </Col>
)}
```

- [ ] **Step 4: Verify the button appears in Settings page**

Run: `npm start`
Navigate to Settings. Expected: "Generate Demo Data" button appears at the bottom. Click it, confirm in the popconfirm dialog, and verify:
- All data is wiped and repopulated
- Page reloads to login screen
- Login with admin/admin works
- Check Members, Events, Tasks, ORBAT pages for populated data

- [ ] **Step 5: Commit**

```bash
git add imports/ui/settings/Settings.jsx imports/i18n/locales/en.json imports/i18n/locales/de.json imports/i18n/locales/fr.json
git commit -m "Add Generate Demo Data button to Settings page (dev-only)"
```

---

## Chunk 2: Walkthrough Guide and Testing

### Task 3: Create the demo walkthrough cheat sheet

**Files:**
- Create: `docs/demo-walkthrough-guide.md`

- [ ] **Step 1: Write the walkthrough guide**

Create `docs/demo-walkthrough-guide.md` with this content:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add docs/demo-walkthrough-guide.md
git commit -m "Add demo walkthrough cheat sheet for stakeholder presentation"
```

---

### Task 4: Manual testing and verification

**Files:** None (testing only)

- [ ] **Step 1: Start the app fresh**

```bash
npm start
```

- [ ] **Step 2: Log in as admin/admin and navigate to Settings**

Verify the "Generate Demo Data" button is visible.

- [ ] **Step 3: Click "Generate Demo Data" and confirm**

Expected: Loading spinner on button, then alert with success message, then page reload to login.

- [ ] **Step 4: Log in as admin/admin and verify all sections**

Check each page has populated data:
- **Dashboard** - Stats should show counts
- **Members** - 10 members with names, ranks, squads
- **Squads** - 4 squads (HQ, Alpha, Bravo, Charlie)
- **ORBAT** - Hierarchical chart with HQ at top, 3 child squads
- **Ranks** - 6 ranks in progression order
- **Specializations** - 5 specializations
- **Medals** - 4 medals
- **Events** - Calendar shows past and upcoming events near current date
- **Attendance** - Past events have attendance data with color-coded statuses
- **Tasks** - Kanban board with tasks in To Do, In Progress, Done columns
- **Questionnaires** - 1 active questionnaire with 3 responses
- **Registrations** - 3 pending applications
- **Roles** - 3 roles (Admin, Officer, Member)
- **Logs** - Should have a `demoData.generated` log entry
- **Settings** - Community title "Task Force Sentinel", color set

- [ ] **Step 5: Test the permission demo**

Open incognito browser, navigate to localhost:3000, log in as `ghost`/`demo` (has "Member" role). Verify:
- Settings page is not accessible (no `settings` permission)
- Logs page is not accessible (no `logs` permission)
- Members table is visible but has no create/edit/delete buttons (read-only)
- Events are visible but cannot be created
- Tasks are visible and can be created (Member role has task create/update)
- Dashboard and ORBAT are accessible (boolean permissions enabled)

- [ ] **Step 6: Run existing tests to verify nothing is broken**

Run: `npm test`
Expected: All existing tests pass. The new method doesn't need unit tests since it's a dev-only utility for demo data seeding.
