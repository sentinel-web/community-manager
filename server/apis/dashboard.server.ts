import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import DiscoveryTypesCollection from '../../imports/api/collections/discoveryTypes.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import TaskStatusCollection from '../../imports/api/collections/taskStatus.collection';
import type { Role } from '/imports/api/types';

// Loose generic so a single helper can aggregate over any project collection.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCollection = Mongo.Collection<any>;

async function aggregateCountByField(
  collection: AnyCollection,
  groupField: string,
  nameMap: Map<string | undefined, string>,
): Promise<Record<string, number>> {
  const pipeline = [{ $match: { [groupField]: { $ne: null } } }, { $group: { _id: `$${groupField}`, count: { $sum: 1 } } }];
  const rawCollection = collection.rawCollection();
  const aggregationResult = await (rawCollection as unknown as { aggregate(p: unknown[]): { toArray(): Promise<Array<{ _id: string; count: number }>> } }).aggregate(pipeline).toArray();
  const result: Record<string, number> = {};
  for (const item of aggregationResult) {
    const name = nameMap.get(item._id);
    if (name) result[name] = item.count;
  }
  return result;
}

async function aggregateCountByArrayField(
  collection: AnyCollection,
  arrayField: string,
  nameMap: Map<string | undefined, string>,
): Promise<Record<string, number>> {
  const pipeline = [
    { $match: { [arrayField]: { $exists: true, $ne: [] } } },
    { $unwind: `$${arrayField}` },
    { $group: { _id: `$${arrayField}`, count: { $sum: 1 } } },
  ];
  const rawCollection = collection.rawCollection();
  const aggregationResult = await (rawCollection as unknown as { aggregate(p: unknown[]): { toArray(): Promise<Array<{ _id: string; count: number }>> } }).aggregate(pipeline).toArray();
  const result: Record<string, number> = {};
  for (const item of aggregationResult) {
    const name = nameMap.get(item._id);
    if (name) result[name] = item.count;
  }
  return result;
}

if (Meteor.isServer) {
  Meteor.methods({
    'dashboard.stats': async function (): Promise<Record<string, unknown>> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      const user = await Meteor.users.findOneAsync(this.userId);

      if (!user) throw new Meteor.Error(404, 'User not found');

      const roleId = user.profile?.roleId;

      if (!roleId) throw new Meteor.Error(404, 'Role not found');

      const role = (await RolesCollection.findOneAsync({ _id: roleId })) as Role | undefined;

      if (!role) throw new Meteor.Error(404, 'Role not found');

      const result: Record<string, unknown> = {};

      result.profile = await Meteor.callAsync('members.profileStats', user, role);

      if (role.registrations) result['registrations count'] = await RegistrationsCollection.countDocuments();
      if (role.discoveryTypes) {
        const discoveryTypes = await DiscoveryTypesCollection.find().fetchAsync();
        const discoveryTypeNameByIdMap = new Map(discoveryTypes.map(dt => [dt._id, dt.name]));
        result['registrations by discovery type'] = await aggregateCountByField(
          RegistrationsCollection as AnyCollection,
          'discoveryType',
          discoveryTypeNameByIdMap,
        );
      }

      if (role.squads) {
        const squads = await SquadsCollection.find().fetchAsync();
        const squadNameByIdMap = new Map(squads.map(s => [s._id, s.name]));
        result['member count by squad'] = await aggregateCountByField(MembersCollection as AnyCollection, 'profile.squadId', squadNameByIdMap);
      }

      if (role.members) result['member count'] = await MembersCollection.countDocuments();

      if (role.ranks) {
        const ranks = await RanksCollection.find().fetchAsync();
        const rankNameByIdMap = new Map(ranks.map(r => [r._id, r.name]));
        result['member count by rank'] = await aggregateCountByField(MembersCollection as AnyCollection, 'profile.rankId', rankNameByIdMap);
      }

      if (role.specializations) {
        const specializations = await SpecializationsCollection.find().fetchAsync();
        const specializationNameByIdMap = new Map(specializations.map(s => [s._id, s.name]));
        result['member count by specialization'] = await aggregateCountByArrayField(
          MembersCollection as AnyCollection,
          'profile.specializationIds',
          specializationNameByIdMap,
        );
      }

      if (role.medals) {
        const medals = await MedalsCollection.find().fetchAsync();
        const medalNameByIdMap = new Map(medals.map(m => [m._id, m.name]));
        result['member count by medal'] = await aggregateCountByArrayField(MembersCollection as AnyCollection, 'profile.medalIds', medalNameByIdMap);
      }

      if (role.events) result['event count'] = await EventsCollection.countDocuments();
      if (role.eventTypes) {
        const eventTypes = await EventTypesCollection.find().fetchAsync();
        const eventTypeNameByIdMap = new Map(eventTypes.map(et => [et._id, et.name]));
        result['event count by event type'] = await aggregateCountByField(EventsCollection as AnyCollection, 'eventType', eventTypeNameByIdMap);
      }

      if (role.tasks) result['task count'] = await TasksCollection.countDocuments();
      if (role.taskStatus) {
        const taskStatuses = await TaskStatusCollection.find().fetchAsync();
        const taskStatusNameByIdMap = new Map(taskStatuses.map(ts => [ts._id, ts.name]));
        result['task count by task status'] = await aggregateCountByField(TasksCollection as AnyCollection, 'status', taskStatusNameByIdMap);
      }

      if (role.roles) {
        const roles = await RolesCollection.find().fetchAsync();
        const roleNameByIdMap = new Map(roles.map(r => [r._id, r.name]));
        result['member count by role'] = await aggregateCountByField(MembersCollection as AnyCollection, 'profile.roleId', roleNameByIdMap);
      }

      return result;
    },
  });
}
