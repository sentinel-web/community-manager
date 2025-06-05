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
        const discoveryTypeNameByIdMap = new Map(discoveryTypes.map(discoveryType => [discoveryType._id, discoveryType.name]));
        result['registrations by discovery type'] = {};
        await RegistrationsCollection.find().forEachAsync(registration => {
          if (!registration.discoveryType) return;
          const discoveryTypeName = discoveryTypeNameByIdMap.get(registration.discoveryType);
          result['registrations by discovery type'][discoveryTypeName] = result['registrations by discovery type'][registration.discoveryType] || 0;
          result['registrations by discovery type'][discoveryTypeName]++;
        });
      }

      const members = await MembersCollection.find().fetchAsync();
      const hasSquads = role.squads;
      if (hasSquads) {
        const squads = await SquadsCollection.find().fetchAsync();
        const squadNameByIdMap = new Map(squads.map(squad => [squad._id, squad.name]));
        result['member count by squad'] = {};
        members.forEach(member => {
          if (!member.profile?.squadId) return;
          const squadName = squadNameByIdMap.get(member.profile?.squadId);
          result['member count by squad'][squadName] = result['member count by squad'][squadName] || 0;
          result['member count by squad'][squadName]++;
        });
      }
      const hasMembers = role.members;
      if (hasMembers) result['member count'] = members.length;
      const hasRanks = role.ranks;
      if (hasRanks) {
        const ranks = await RanksCollection.find().fetchAsync();
        const rankNameByIdMap = new Map(ranks.map(rank => [rank._id, rank.name]));
        result['member count by rank'] = {};
        members.forEach(member => {
          if (!member.profile?.rankId) return;
          const rankName = rankNameByIdMap.get(member.profile?.rankId);
          result['member count by rank'][rankName] = result['member count by rank'][rankName] || 0;
          result['member count by rank'][rankName]++;
        });
      }
      const hasSpecializations = role.specializations;
      if (hasSpecializations) {
        const specializations = await SpecializationsCollection.find().fetchAsync();
        const specializationNameByIdMap = new Map(specializations.map(specialization => [specialization._id, specialization.name]));
        result['member count by specialization'] = {};
        members.forEach(member => {
          member.profile?.specializationIds?.forEach?.(specializationId => {
            const specializationName = specializationNameByIdMap.get(specializationId);
            result['member count by specialization'][specializationName] = result['member count by specialization'][specializationName] || 0;
            result['member count by specialization'][specializationName]++;
          });
        });
      }
      const hasMedals = role.medals;
      if (hasMedals) {
        const medals = await MedalsCollection.find().fetchAsync();
        const medalNameByIdMap = new Map(medals.map(medal => [medal._id, medal.name]));
        result['member count by medal'] = {};
        members.forEach(member => {
          member.profile?.medalIds?.forEach?.(medalId => {
            const medalName = medalNameByIdMap.get(medalId);
            result['member count by medal'][medalName] = result['member count by medal'][medalName] || 0;
            result['member count by medal'][medalName]++;
          });
        });
      }

      const hasEvents = role.events;
      if (hasEvents) result['event count'] = await EventsCollection.countDocuments();
      const hasEventTypes = role.eventTypes;
      if (hasEventTypes) {
        const eventTypes = await EventTypesCollection.find().fetchAsync();
        const eventTypeNameByIdMap = new Map(eventTypes.map(eventType => [eventType._id, eventType.name]));
        result['event count by event type'] = {};
        await EventsCollection.find().forEachAsync(event => {
          if (!event.eventTypeId) return;
          const eventTypeName = eventTypeNameByIdMap.get(event.eventTypeId);
          result['event count by event type'][eventTypeName] = result['event count by event type'][eventTypeName] || 0;
          result['event count by event type'][eventTypeName]++;
        });
      }

      const hasTasks = role.tasks;
      if (hasTasks) result['task count'] = await TasksCollection.countDocuments();
      const hasTaskStatuses = role.taskStatus;
      if (hasTaskStatuses) {
        const taskStatuses = await TaskStatusCollection.find().fetchAsync();
        const taskStatusNameByIdMap = new Map(taskStatuses.map(taskStatus => [taskStatus._id, taskStatus.name]));
        result['task count by task status'] = {};
        await TasksCollection.find().forEachAsync(task => {
          if (!task.status) return;
          const taskStatusName = taskStatusNameByIdMap.get(task.status);
          result['task count by task status'][taskStatusName] = result['task count by task status'][taskStatusName] || 0;
          result['task count by task status'][taskStatusName]++;
        });
      }

      const hasRoles = role.roles;
      if (hasRoles) {
        const roles = await RolesCollection.find().fetchAsync();
        const roleNameByIdMap = new Map(roles.map(role => [role._id, role.name]));
        result['member count by role'] = {};
        members.forEach(member => {
          if (!member.profile?.roleId) return;
          const roleName = roleNameByIdMap.get(member.profile?.roleId);
          result['member count by role'][roleName] = result['member count by role'][roleName] || 0;
          result['member count by role'][roleName]++;
        });
      }

      return result;
    },
  });
}
