import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import {
  validateObject,
  validateString,
  validateArrayOfStrings,
  checkPermission,
  checkSpecialPermission,
  getPermissionModule,
  clearRoleCache,
} from './main';
import { createLog } from './apis/logs.server';
import type { CrudCollectionMap, CrudCollectionName } from '/imports/api/types';

const SPECIAL_PERMISSION_FALLBACK: Record<string, { create?: string; update?: string }> = {
  events: { create: 'canCreateEvents' },
  tasks: { create: 'canManageTasks', update: 'canManageTasks' },
};

import AttendancesCollection from '../imports/api/collections/attendances.collection';
import DiscoveryTypesCollection from '../imports/api/collections/discoveryTypes.collection';
import EventsCollection from '../imports/api/collections/events.collection';
import EventTypesCollection from '../imports/api/collections/eventTypes.collection';
import LogsCollection from '../imports/api/collections/logs.collection';
import MedalsCollection from '../imports/api/collections/medals.collection';
import MembersCollection from '../imports/api/collections/members.collection';
import PositionsCollection from '../imports/api/collections/positions.collection';
import ProfilePicturesCollection from '../imports/api/collections/profilePictures.collection';
import QuestionnairesCollection from '../imports/api/collections/questionnaires.collection';
import QuestionnaireResponsesCollection from '../imports/api/collections/questionnaireResponses.collection';
import RanksCollection from '../imports/api/collections/ranks.collection';
import RegistrationsCollection from '../imports/api/collections/registrations.collection';
import RolesCollection from '../imports/api/collections/roles.collection';
import SpecializationsCollection from '../imports/api/collections/specializations.collection';
import SquadsCollection from '../imports/api/collections/squads.collection';
import TasksCollection from '../imports/api/collections/tasks.collection';
import TaskStatusCollection from '../imports/api/collections/taskStatus.collection';

export function getCollection<K extends CrudCollectionName>(
  collection: K,
): Mongo.Collection<CrudCollectionMap[K]> {
  if (!collection) throw new Meteor.Error(400, 'No collection name');
  switch (collection) {
    case 'attendances':
      return AttendancesCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'discoveryTypes':
      return DiscoveryTypesCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'events':
      return EventsCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'eventTypes':
      return EventTypesCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'logs':
      return LogsCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'medals':
      return MedalsCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'members':
      return MembersCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'positions':
      return PositionsCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'profilePictures':
      return ProfilePicturesCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'questionnaires':
      return QuestionnairesCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'questionnaireResponses':
      return QuestionnaireResponsesCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'ranks':
      return RanksCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'registrations':
      return RegistrationsCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'roles':
      return RolesCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'specializations':
      return SpecializationsCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'squads':
      return SquadsCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'tasks':
      return TasksCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    case 'taskStatus':
      return TaskStatusCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
    default:
      throw new Meteor.Error(404, `Collection "${collection}" not found`);
  }
}

const DEFAULT_PUBLISH_LIMIT = 100;
const MAX_PUBLISH_LIMIT = 1000;

function createCollectionPublish(collection: CrudCollectionName): void {
  if (Meteor.isServer) {
    const Collection = getCollection(collection);
    Meteor.publish(collection, function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      if (!this.userId) return this.ready();
      validateObject(filter, false);
      validateObject(options, false);

      const limitedOptions: Record<string, unknown> = { ...options };
      if (!limitedOptions.limit) {
        limitedOptions.limit = DEFAULT_PUBLISH_LIMIT;
      } else if ((limitedOptions.limit as number) > MAX_PUBLISH_LIMIT) {
        limitedOptions.limit = MAX_PUBLISH_LIMIT;
      }

      return Collection.find(filter, limitedOptions);
    });
  }
}

function createCollectionMethods(collection: CrudCollectionName): void {
  try {
    if (Meteor.isServer) {
      const Collection = getCollection(collection);
      const unsafeCollections: readonly string[] = ['registrations'];
      const permissionModule = getPermissionModule(collection);

      Meteor.methods({
        [`${collection}.read`]: async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          validateObject(filter, false);
          validateObject(options, false);

          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'read');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          return await Collection.find(filter, options).fetchAsync();
        },
        [`${collection}.insert`]: async function (payload: Record<string, unknown> = {}) {
          if (!this.userId && !unsafeCollections.includes(collection)) throw new Meteor.Error(401, 'Unauthorized');
          validateObject(payload, false);

          if (permissionModule && this.userId) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'create');
            if (!hasPermission) {
              const fallbackFlag = SPECIAL_PERMISSION_FALLBACK[collection]?.create;
              const hasSpecial = fallbackFlag ? await checkSpecialPermission(this.userId, fallbackFlag) : false;
              if (!hasSpecial) throw new Meteor.Error(403, 'Permission denied');
            }
          }

          if (collection === 'tasks') {
            payload.createdAt = new Date();
          }
          const id = await Collection.insertAsync(payload as unknown as CrudCollectionMap[typeof collection]);
          if (collection !== 'logs') {
            await createLog(`${collection}.created`, { id, ...payload });
          }
          return id;
        },
        [`${collection}.update`]: async function (id: string = '', data: Record<string, unknown> = {}) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          validateString(id, false);
          validateObject(data, false);

          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'update');
            if (!hasPermission) {
              const fallbackFlag = SPECIAL_PERMISSION_FALLBACK[collection]?.update;
              const hasSpecial = fallbackFlag ? await checkSpecialPermission(this.userId, fallbackFlag) : false;
              if (!hasSpecial) throw new Meteor.Error(403, 'Permission denied');
            }
          }

          const result = await Collection.updateAsync({ _id: id } as never, { $set: data } as never);
          if (collection !== 'logs') {
            await createLog(`${collection}.updated`, { id, changes: data });
          }

          if (collection === 'roles') {
            clearRoleCache(id);
          }

          return result;
        },
        [`${collection}.remove`]: async function (id: string = '') {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          validateString(id, false);

          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'delete');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          const doc = await Collection.findOneAsync(id);
          if (!doc) throw new Meteor.Error(404, 'Document not found');
          const result = await Collection.removeAsync({ _id: id } as never);
          if (collection !== 'logs') {
            await createLog(`${collection}.deleted`, { id });
          }

          if (collection === 'roles') {
            clearRoleCache(id);
          }

          return result;
        },
        [`${collection}.bulkRemove`]: async function (ids: string[] = []) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          validateArrayOfStrings(ids, false);
          if (ids.length === 0) throw new Meteor.Error(400, 'No ids provided');
          if (ids.length > 100) throw new Meteor.Error(400, 'Maximum 100 items per bulk delete');

          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'delete');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          let removed = 0;
          const errors: string[] = [];

          for (const id of ids) {
            try {
              const doc = await Collection.findOneAsync(id);
              if (!doc) {
                errors.push(`Document ${id} not found`);
                continue;
              }
              await Collection.removeAsync({ _id: id } as never);
              if (collection !== 'logs') {
                await createLog(`${collection}.deleted`, { id });
              }
              if (collection === 'roles') {
                clearRoleCache(id);
              }
              removed++;
            } catch (error) {
              errors.push(`Failed to delete ${id}: ${(error as Error).message}`);
            }
          }

          return { removed, errors };
        },
        [`${collection}.count`]: async function (filter: Record<string, unknown> = {}) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          validateObject(filter, false);

          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'read');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          return await Collection.countDocuments(filter);
        },
        [`${collection}.options`]: async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
          if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
          validateObject(filter, false);
          validateObject(options, false);

          if (permissionModule) {
            const hasPermission = await checkPermission(this.userId, permissionModule, 'read');
            if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          }

          return await Collection.find(filter, options).mapAsync((item: any) => {
            const profile = item.profile as { name?: string } | undefined;
            const name = profile?.name || (item.name as string | undefined);
            return { key: item._id, label: name, title: name, value: item._id, raw: item };
          });
        },
      });
    }
  } catch (error) {
    createLog('crud.methodCreationError', { collection, error: (error as Error).message });
  }
}

export { createCollectionMethods, createCollectionPublish };
