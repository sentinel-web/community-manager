import { Meteor } from 'meteor/meteor';
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

// Helper to run aggregation and convert IDs to names
async function aggregateCountByField(collection, groupField, nameMap) {
  const pipeline = [{ $match: { [groupField]: { $ne: null } } }, { $group: { _id: `$${groupField}`, count: { $sum: 1 } } }];
  const rawCollection = collection.rawCollection();
  const aggregationResult = await rawCollection.aggregate(pipeline).toArray();
  const result = {};
  for (const item of aggregationResult) {
    const name = nameMap.get(item._id);
    if (name) result[name] = item.count;
  }
  return result;
}

// Helper for array field aggregation (unwinds array before grouping)
async function aggregateCountByArrayField(collection, arrayField, nameMap) {
  const pipeline = [
    { $match: { [arrayField]: { $exists: true, $ne: [] } } },
    { $unwind: `$${arrayField}` },
    { $group: { _id: `$${arrayField}`, count: { $sum: 1 } } },
  ];
  const rawCollection = collection.rawCollection();
  const aggregationResult = await rawCollection.aggregate(pipeline).toArray();
  const result = {};
  for (const item of aggregationResult) {
    const name = nameMap.get(item._id);
    if (name) result[name] = item.count;
  }
  return result;
}

if (Meteor.isServer) {
  Meteor.methods({
    'dashboard.stats': async function () {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      const user = await Meteor.users.findOneAsync(this.userId);

      if (!user) throw new Meteor.Error(404, 'User not found');

      const roleId = user.profile?.roleId;

      if (!roleId) throw new Meteor.Error(404, 'Role not found');

      const role = await RolesCollection.findOneAsync({ _id: roleId });

      if (!role) throw new Meteor.Error(404, 'Role not found');

      const result = {};

      result.profile = await Meteor.callAsync('members.profileStats', user, role);

      const hasRegistrations = role.registrations;
      if (hasRegistrations) result['registrations count'] = await RegistrationsCollection.countDocuments();
      const hasDiscoveryTypes = role.discoveryTypes;
      if (hasDiscoveryTypes) {
        const discoveryTypes = await DiscoveryTypesCollection.find().fetchAsync();
        const discoveryTypeNameByIdMap = new Map(discoveryTypes.map(dt => [dt._id, dt.name]));
        result['registrations by discovery type'] = await aggregateCountByField(
          RegistrationsCollection,
          'discoveryType',
          discoveryTypeNameByIdMap
        );
      }

      const hasSquads = role.squads;
      if (hasSquads) {
        const squads = await SquadsCollection.find().fetchAsync();
        const squadNameByIdMap = new Map(squads.map(s => [s._id, s.name]));
        result['member count by squad'] = await aggregateCountByField(MembersCollection, 'profile.squadId', squadNameByIdMap);
      }

      const hasMembers = role.members;
      if (hasMembers) result['member count'] = await MembersCollection.countDocuments();

      const hasRanks = role.ranks;
      if (hasRanks) {
        const ranks = await RanksCollection.find().fetchAsync();
        const rankNameByIdMap = new Map(ranks.map(r => [r._id, r.name]));
        result['member count by rank'] = await aggregateCountByField(MembersCollection, 'profile.rankId', rankNameByIdMap);
      }

      const hasSpecializations = role.specializations;
      if (hasSpecializations) {
        const specializations = await SpecializationsCollection.find().fetchAsync();
        const specializationNameByIdMap = new Map(specializations.map(s => [s._id, s.name]));
        result['member count by specialization'] = await aggregateCountByArrayField(
          MembersCollection,
          'profile.specializationIds',
          specializationNameByIdMap
        );
      }

      const hasMedals = role.medals;
      if (hasMedals) {
        const medals = await MedalsCollection.find().fetchAsync();
        const medalNameByIdMap = new Map(medals.map(m => [m._id, m.name]));
        result['member count by medal'] = await aggregateCountByArrayField(MembersCollection, 'profile.medalIds', medalNameByIdMap);
      }

      const hasEvents = role.events;
      if (hasEvents) result['event count'] = await EventsCollection.countDocuments();
      const hasEventTypes = role.eventTypes;
      if (hasEventTypes) {
        const eventTypes = await EventTypesCollection.find().fetchAsync();
        const eventTypeNameByIdMap = new Map(eventTypes.map(et => [et._id, et.name]));
        result['event count by event type'] = await aggregateCountByField(EventsCollection, 'eventTypeId', eventTypeNameByIdMap);
      }

      const hasTasks = role.tasks;
      if (hasTasks) result['task count'] = await TasksCollection.countDocuments();
      const hasTaskStatuses = role.taskStatus;
      if (hasTaskStatuses) {
        const taskStatuses = await TaskStatusCollection.find().fetchAsync();
        const taskStatusNameByIdMap = new Map(taskStatuses.map(ts => [ts._id, ts.name]));
        result['task count by task status'] = await aggregateCountByField(TasksCollection, 'status', taskStatusNameByIdMap);
      }

      const hasRoles = role.roles;
      if (hasRoles) {
        const roles = await RolesCollection.find().fetchAsync();
        const roleNameByIdMap = new Map(roles.map(r => [r._id, r.name]));
        result['member count by role'] = await aggregateCountByField(MembersCollection, 'profile.roleId', roleNameByIdMap);
      }

      return result;
    },
  });
}
