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

const MEMBERS = [
  { username: 'admin', password: 'admin', profile: { name: 'Admin', id: 1000, roleId: 'admin', squadId: 'hq', rankId: 'captain', specializationIds: [], medalIds: ['leadership', 'service'], description: 'Community administrator', entryDate: new Date('2024-01-15'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'viper', password: 'demo', profile: { name: 'Viper', id: 1001, roleId: 'officer', squadId: 'alpha', rankId: 'lieutenant', specializationIds: ['marksman', 'jtac'], medalIds: ['combat', 'service'], description: 'Alpha squad leader', entryDate: new Date('2024-03-10'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'doc', password: 'demo', profile: { name: 'Doc', id: 1002, roleId: 'officer', squadId: 'bravo', rankId: 'sergeant', specializationIds: ['medic'], medalIds: ['service'], description: 'Bravo squad medic and leader', entryDate: new Date('2024-05-22'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'ghost', password: 'demo', profile: { name: 'Ghost', id: 1003, roleId: 'member', squadId: 'charlie', rankId: 'sergeant', specializationIds: ['marksman'], medalIds: ['combat'], description: 'Recon specialist', entryDate: new Date('2024-06-01'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'hammer', password: 'demo', profile: { name: 'Hammer', id: 1004, roleId: 'member', squadId: 'alpha', rankId: 'corporal', specializationIds: ['engineer'], medalIds: [], description: 'Demolitions expert', entryDate: new Date('2024-08-15'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'phoenix', password: 'demo', profile: { name: 'Phoenix', id: 1005, roleId: 'member', squadId: 'bravo', rankId: 'corporal', specializationIds: ['pilot'], medalIds: ['instructor'], description: 'Rotary wing pilot', entryDate: new Date('2024-09-03'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'frost', password: 'demo', profile: { name: 'Frost', id: 1006, roleId: 'member', squadId: 'charlie', rankId: 'private', specializationIds: ['medic'], medalIds: [], description: 'Field medic in training', entryDate: new Date('2025-01-10'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'blaze', password: 'demo', profile: { name: 'Blaze', id: 1007, roleId: 'member', squadId: 'alpha', rankId: 'private', specializationIds: [], medalIds: [], description: 'New assault team member', entryDate: new Date('2025-03-20'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'raven', password: 'demo', profile: { name: 'Raven', id: 1008, roleId: 'member', squadId: 'bravo', rankId: 'private', specializationIds: [], medalIds: [], description: 'Support gunner', entryDate: new Date('2025-06-15'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
  { username: 'wolf', password: 'demo', profile: { name: 'Wolf', id: 1009, roleId: 'member', squadId: 'charlie', rankId: 'recruit', specializationIds: [], medalIds: [], description: 'Recently joined, completing basic training', entryDate: new Date('2026-02-01'), taskFilter: { status: ['todo', 'in-progress', 'done'] } } },
];

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

function createQuestionnaire() {
  return {
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
}

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
  await QuestionnairesCollection.insertAsync(createQuestionnaire());
  const responses = createQuestionnaireResponses(memberIds);
  for (const resp of responses) await QuestionnaireResponsesCollection.insertAsync(resp);

  // 7. Registrations (standalone)
  for (const reg of REGISTRATIONS) await RegistrationsCollection.insertAsync(reg);

  // 8. Settings
  for (const setting of SETTINGS) await SettingsCollection.insertAsync(setting);
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
      await createLog('demoData.generated', { userId: this.userId });
      return true;
    },
  });
}
