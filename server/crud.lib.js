import { Meteor } from 'meteor/meteor';
import { validateObject, validateString, checkPermission, getPermissionModule, clearRoleCache } from './main';
import { createLog } from './apis/logs.server';

import AttendancesCollection from '../imports/api/collections/attendances.collection';
import DiscoveryTypesCollection from '../imports/api/collections/discoveryTypes.collection';
import EventsCollection from '../imports/api/collections/events.collection';
import EventTypesCollection from '../imports/api/collections/eventTypes.collection';
import LogsCollection from '../imports/api/collections/logs.collection';
import MedalsCollection from '../imports/api/collections/medals.collection';
import MembersCollection from '../imports/api/collections/members.collection';
import ProfilePicturesCollection from '../imports/api/collections/profilePictures.collection';
import RanksCollection from '../imports/api/collections/ranks.collection';
import RegistrationsCollection from '../imports/api/collections/registrations.collection';
import RolesCollection from '../imports/api/collections/roles.collection';
import SpecializationsCollection from '../imports/api/collections/specializations.collection';
import SquadsCollection from '../imports/api/collections/squads.collection';
import TasksCollection from '../imports/api/collections/tasks.collection';
import TaskStatusCollection from '../imports/api/collections/taskStatus.collection';

export function getCollection(collection) {
  if (!collection) throw new Meteor.Error(400, 'No collection name');
  switch (collection) {
    case 'eventTypes':
      return EventTypesCollection;
    case 'ranks':
      return RanksCollection;
    case 'discoveryTypes':
      return DiscoveryTypesCollection;
    case 'taskStatus':
      return TaskStatusCollection;
    case 'medals':
      return MedalsCollection;
    case 'events':
      return EventsCollection;
    case 'logs':
      return LogsCollection;
    case 'attendances':
      return AttendancesCollection;
    case 'members':
      return MembersCollection;
    case 'squads':
      return SquadsCollection;
    case 'specializations':
      return SpecializationsCollection;
    case 'tasks':
      return TasksCollection;
    case 'registrations':
      return RegistrationsCollection;
    case 'profilePictures':
      return ProfilePicturesCollection;
    case 'roles':
      return RolesCollection;
    default:
      throw new Meteor.Error(404, `Collection "${collection}" not found`);
  }
}

function createCollectionPublish(collection) {
  if (Meteor.isServer) {
    const Collection = getCollection(collection);
    Meteor.publish(collection, function (filter = {}, options = {}) {
      if (!this.userId) return this.ready();
      if (validateObject(filter, false)) return [];
      if (validateObject(options, false)) return [];
      return Collection.find(filter, options);
    });
  }
}

function createCollectionMethods(collection) {
  try {
    if (Meteor.isServer) {
      const Collection = getCollection(collection);
      const unsafeCollections = ['registrations'];
      const permissionModule = getPermissionModule(collection);

      Meteor.methods({
        [`${collection}.read`]: async function (filter = {}, options = {}) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          if (validateObject(filter, false)) throw new Meteor.Error(400, 'Invalid filter');
          if (validateObject(options, false)) throw new Meteor.Error(400, 'Invalid options');

          // Check read permission
          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'read');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          return await Collection.find(filter, options).fetchAsync();
        },
        [`${collection}.insert`]: async function (payload = {}) {
          if (!this.userId && !unsafeCollections.includes(collection)) throw new Meteor.Error(401, 'Unauthorized');
          if (validateObject(payload, false)) throw new Meteor.Error(400, 'Invalid payload');

          // Check create permission (skip for unsafe collections like registrations)
          if (permissionModule && this.userId) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'create');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          const id = await Collection.insertAsync(payload);
          if (collection !== 'logs') {
            await createLog(`${collection}.created`, { id, ...payload });
          }
          return id;
        },
        [`${collection}.update`]: async function (id = '', data = {}) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          if (validateString(id, false)) throw new Meteor.Error(400, 'Invalid id');
          if (validateObject(data, false)) throw new Meteor.Error(400, 'Invalid data');

          // Check update permission
          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'update');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          const result = await Collection.updateAsync({ _id: id }, { $set: data });
          if (collection !== 'logs') {
            await createLog(`${collection}.updated`, { id, changes: data });
          }

          // Clear role cache when roles are updated
          if (collection === 'roles') {
            clearRoleCache(id);
          }

          return result;
        },
        [`${collection}.remove`]: async function (id = '') {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          if (validateString(id, false)) throw new Meteor.Error(400, 'Invalid id');

          // Check delete permission
          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'delete');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          const doc = await Collection.findOneAsync(id);
          if (!doc) throw new Meteor.Error(404, 'Document not found');
          const result = await Collection.removeAsync({ _id: id });
          if (collection !== 'logs') {
            await createLog(`${collection}.deleted`, { id });
          }

          // Clear role cache when roles are deleted
          if (collection === 'roles') {
            clearRoleCache(id);
          }

          return result;
        },
        [`${collection}.count`]: async function (filter = {}) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          if (validateObject(filter, false)) throw new Meteor.Error(400, 'Invalid filter');

          // Check read permission for count
          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'read');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          return await Collection.countDocuments(filter);
        },
        [`${collection}.options`]: async function (filter = {}, options = {}) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          if (validateObject(filter, false)) throw new Meteor.Error(400, 'Invalid filter');
          if (validateObject(options, false)) throw new Meteor.Error(400, 'Invalid options');

          // Check read permission for options
          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'read');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          return await Collection.find(filter, options).mapAsync(item => {
            const name = item.profile?.name || item.name;
            return { key: item._id, label: name, title: name, value: item._id, raw: item };
          });
        },
      });
    }
  } catch (error) {
    console.error(error);
  }
}

export { createCollectionMethods, createCollectionPublish };
