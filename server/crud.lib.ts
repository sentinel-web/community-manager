import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import {
  validateObject,
  validateString,
  validateArrayOfStrings,
  clearRoleCache,
} from './main';
import { createLog } from './apis/logs.server';
import { runMutation, snapshotTouchedFields } from './mutation-pipeline';
import { COLLECTION_REGISTRY } from './collection-registry';
import { enforceIntegrityOnDelete, buildRemoveAuditPayload, validateForeignKeys } from './integrity';
import { sanitizeHtml } from './htmlSanitizer';
import type { CrudCollectionMap, CrudCollectionName } from '/imports/api/types';

import AttendancesCollection from '../imports/api/collections/attendances.collection';
import BriefingTemplatesCollection from '../imports/api/collections/briefingTemplates.collection';
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
    case 'briefingTemplates':
      return BriefingTemplatesCollection as unknown as Mongo.Collection<CrudCollectionMap[K]>;
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

// Rich-text HTML fields, sanitized on every write so MongoDB never stores
// hostile markup (ADR 0001). Kept as inline code rather than a registry field:
// per the Rule of Three doctrine, a variation present in only 1–2 collections
// stays as code until a third site appears.
const HTML_FIELDS: Partial<Record<CrudCollectionName, readonly string[]>> = {
  briefingTemplates: ['content'],
  events: ['description'],
};

function sanitizeHtmlFields(collection: CrudCollectionName, payload: Record<string, unknown>): void {
  const fields = HTML_FIELDS[collection];
  if (!fields) return;
  for (const field of fields) {
    if (typeof payload[field] === 'string') {
      payload[field] = sanitizeHtml(payload[field]);
    }
  }
}

const DEFAULT_PUBLISH_LIMIT = 100;
const MAX_PUBLISH_LIMIT = 1000;

function createCollectionPublish(collection: CrudCollectionName): void {
  if (Meteor.isServer) {
    const Collection = getCollection(collection);
    const allowsAnonymousRead = COLLECTION_REGISTRY[collection].allowsAnonymous?.read === true;
    Meteor.publish(collection, function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      if (!this.userId && !allowsAnonymousRead) return this.ready();
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
      const registryEntry = COLLECTION_REGISTRY[collection];
      const permissionModule = registryEntry.module;
      const fallback = registryEntry.fallback;
      const allowsAnonymousInsert = registryEntry.allowsAnonymous?.insert === true;
      const auditAllowed = collection !== 'logs';

      Meteor.methods({
        [`${collection}.read`]: async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
          return runMutation(
            { userId: this.userId },
            {
              collection,
              operation: 'read',
              permissionModule,
              validate: ([f, o]) => {
                validateObject(f, false);
                validateObject(o, false);
              },
            },
            [filter, options] as const,
            async ([f, o]) => Collection.find(f, o).fetchAsync(),
          );
        },
        [`${collection}.insert`]: async function (payload: Record<string, unknown> = {}) {
          return runMutation(
            { userId: this.userId },
            {
              collection,
              operation: 'create',
              action: auditAllowed ? `${collection}.created` : undefined,
              auditShape: 'insert',
              permissionModule,
              fallbackFlag: fallback?.create,
              allowAnonymous: allowsAnonymousInsert,
              validate: ([p]) => validateObject(p, false),
            },
            [payload] as const,
            async ([p]) => {
              if (collection === 'tasks') {
                p.createdAt = new Date();
              }
              sanitizeHtmlFields(collection, p);
              await validateForeignKeys(collection, p);
              return Collection.insertAsync(p as unknown as CrudCollectionMap[typeof collection]);
            },
          );
        },
        [`${collection}.update`]: async function (id: string = '', data: Record<string, unknown> = {}) {
          return runMutation(
            { userId: this.userId },
            {
              collection,
              operation: 'update',
              action: auditAllowed ? `${collection}.updated` : undefined,
              auditShape: 'update',
              redact: registryEntry.redact?.update,
              permissionModule,
              fallbackFlag: fallback?.update,
              validate: ([targetId, changes]) => {
                validateString(targetId, false);
                validateObject(changes, false);
              },
              // One indexed _id read so the audit log captures pre-update values
              // for the touched fields, enabling a before→after diff view.
              captureBefore: async ([targetId, changes]) => {
                const doc = await Collection.findOneAsync(targetId);
                return doc
                  ? snapshotTouchedFields(doc as Record<string, unknown>, changes as Record<string, unknown>)
                  : undefined;
              },
            },
            [id, data] as const,
            async ([targetId, changes]) => {
              sanitizeHtmlFields(collection, changes as Record<string, unknown>);
              // The generic CRUD .update wraps changes in $set, so validation
              // runs against the same modifier Mongo will see — touched-fields
              // semantics fall out naturally.
              await validateForeignKeys(collection, { $set: changes });
              const result = await Collection.updateAsync({ _id: targetId } as never, { $set: changes } as never);
              if (collection === 'roles') {
                clearRoleCache(targetId);
              }
              return result;
            },
          );
        },
        [`${collection}.remove`]: async function (id: string = '') {
          const callerUserId = this.userId;
          return runMutation(
            { userId: callerUserId },
            {
              collection,
              operation: 'delete',
              action: auditAllowed ? `${collection}.deleted` : undefined,
              audit: (args, result) => {
                const r = result as { id: string; effects: Awaited<ReturnType<typeof enforceIntegrityOnDelete>> };
                return buildRemoveAuditPayload(r.id, r.effects);
              },
              permissionModule,
              validate: ([targetId]) => validateString(targetId, false),
            },
            [id] as const,
            async ([targetId]) => {
              const doc = await Collection.findOneAsync(targetId);
              if (!doc) throw new Meteor.Error(404, 'Document not found');
              const effects = await enforceIntegrityOnDelete(collection, targetId, { userId: callerUserId });
              await Collection.removeAsync({ _id: targetId } as never);
              if (collection === 'roles') {
                clearRoleCache(targetId);
              }
              return { id: targetId, effects };
            },
          );
        },
        [`${collection}.bulkRemove`]: async function (ids: string[] = []) {
          const callerUserId = this.userId;
          return runMutation(
            { userId: callerUserId },
            {
              collection,
              operation: 'delete',
              permissionModule,
              validate: ([targetIds]) => {
                validateArrayOfStrings(targetIds, false);
                if (targetIds.length === 0) throw new Meteor.Error(400, 'No ids provided');
                if (targetIds.length > 100) throw new Meteor.Error(400, 'Maximum 100 items per bulk delete');
              },
            },
            [ids] as const,
            async ([targetIds]) => {
              let removed = 0;
              const errors: string[] = [];

              for (const id of targetIds) {
                try {
                  const doc = await Collection.findOneAsync(id);
                  if (!doc) {
                    errors.push(`Document ${id} not found`);
                    continue;
                  }
                  const effects = await enforceIntegrityOnDelete(collection, id, { userId: callerUserId });
                  await Collection.removeAsync({ _id: id } as never);
                  if (auditAllowed) {
                    await createLog(`${collection}.deleted`, buildRemoveAuditPayload(id, effects));
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
          );
        },
        [`${collection}.count`]: async function (filter: Record<string, unknown> = {}) {
          return runMutation(
            { userId: this.userId },
            {
              collection,
              operation: 'read',
              permissionModule,
              validate: ([f]) => validateObject(f, false),
            },
            [filter] as const,
            async ([f]) => Collection.countDocuments(f),
          );
        },
        [`${collection}.options`]: async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
          return runMutation(
            { userId: this.userId },
            {
              collection,
              operation: 'read',
              permissionModule,
              validate: ([f, o]) => {
                validateObject(f, false);
                validateObject(o, false);
              },
            },
            [filter, options] as const,
            async ([f, o]) =>
              Collection.find(f, o).mapAsync((item: any) => {
                const profile = item.profile as { name?: string } | undefined;
                const name = profile?.name || (item.name as string | undefined);
                return { key: item._id, label: name, title: name, value: item._id, raw: item };
              }),
          );
        },
      });
    }
  } catch (error) {
    createLog('crud.methodCreationError', { collection, error: (error as Error).message });
  }
}

export { createCollectionMethods, createCollectionPublish };
