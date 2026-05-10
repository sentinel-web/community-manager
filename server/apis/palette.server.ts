import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import QuestionnairesCollection from '../../imports/api/collections/questionnaires.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import { checkPermission, getSquadScope, validateNumber, validateString } from '../main';

export interface PaletteSearchResult {
  members: Array<{ _id: string; username?: string; profile?: Record<string, unknown> }>;
  events: Array<{ _id: string; name: string; start?: Date }>;
  tasks: Array<{ _id: string; name: string; status?: string }>;
  squads: Array<{ _id: string; name: string; color?: string }>;
  registrations: Array<{ _id: string; name: string; id?: number }>;
  questionnaires: Array<{ _id: string; name: string; status?: string }>;
}

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 30;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (Meteor.isServer) {
  Meteor.methods({
    'palette.search': async function (query: string, limit?: number): Promise<PaletteSearchResult> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(query);
      validateNumber(limit, true);

      const trimmed = query.trim();
      if (!trimmed) throw new Meteor.Error(400, 'Empty search query');

      const cap = Math.min(typeof limit === 'number' ? Math.max(1, limit) : DEFAULT_LIMIT, MAX_LIMIT);
      const regex = new RegExp(escapeRegex(trimmed), 'i');
      const fields = { _id: 1 };
      const userId = this.userId;

      const empty: PaletteSearchResult = {
        members: [],
        events: [],
        tasks: [],
        squads: [],
        registrations: [],
        questionnaires: [],
      };

      const [canMembers, canEvents, canTasks, canSquads, canRegistrations, canQuestionnaires] = await Promise.all([
        checkPermission(userId, 'members', 'read'),
        checkPermission(userId, 'events', 'read'),
        checkPermission(userId, 'tasks', 'read'),
        checkPermission(userId, 'squads', 'read'),
        checkPermission(userId, 'registrations', 'read'),
        checkPermission(userId, 'questionnaires', 'read'),
      ]);

      if (canMembers) {
        const squadScope = await getSquadScope(userId);
        const numeric = /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : undefined;
        const memberConditions: Array<Record<string, unknown>> = [{ 'profile.name': regex }, { username: regex }];
        if (numeric !== undefined) memberConditions.push({ 'profile.id': numeric });
        const memberFilter = { ...squadScope, $or: memberConditions };
        empty.members = (await MembersCollection.find(memberFilter, {
          limit: cap,
          fields: { ...fields, username: 1, profile: 1 },
        }).fetchAsync()) as PaletteSearchResult['members'];
      }

      if (canEvents) {
        empty.events = (await EventsCollection.find(
          { name: regex },
          { limit: cap, fields: { ...fields, name: 1, start: 1 } }
        ).fetchAsync()) as unknown as PaletteSearchResult['events'];
      }

      if (canTasks) {
        empty.tasks = (await TasksCollection.find(
          { name: regex },
          { limit: cap, fields: { ...fields, name: 1, status: 1 } }
        ).fetchAsync()) as unknown as PaletteSearchResult['tasks'];
      }

      if (canSquads) {
        empty.squads = (await SquadsCollection.find(
          { name: regex },
          { limit: cap, fields: { ...fields, name: 1, color: 1 } }
        ).fetchAsync()) as unknown as PaletteSearchResult['squads'];
      }

      if (canRegistrations) {
        empty.registrations = (await RegistrationsCollection.find(
          { name: regex },
          { limit: cap, fields: { ...fields, name: 1, id: 1 } }
        ).fetchAsync()) as unknown as PaletteSearchResult['registrations'];
      }

      if (canQuestionnaires) {
        empty.questionnaires = (await QuestionnairesCollection.find(
          { name: regex },
          { limit: cap, fields: { ...fields, name: 1, status: 1 } }
        ).fetchAsync()) as unknown as PaletteSearchResult['questionnaires'];
      }

      return empty;
    },
  });
}
