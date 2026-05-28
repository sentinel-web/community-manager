import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import {
  validateObject,
  validateString,
  validateArrayOfStrings,
  clearRoleCache,
  assertSafeSelector,
  checkPermission,
} from './main';
import { createLog } from './apis/logs.server';
import { runMutation, snapshotTouchedFields } from './mutation-pipeline';
import { COLLECTION_REGISTRY } from './collection-registry';
import {
  enforceIntegrityOnDelete,
  buildRemoveAuditPayload,
  validateForeignKeys,
  validateForeignKeysForUpdate,
} from './integrity';
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

// Typed registry of every CRUD collection, keyed by CrudCollectionName.
//
// The mapped type `{ [K in CrudCollectionName]: Mongo.Collection<CrudCollectionMap[K]> }`
// makes each value's element type follow its key, so the object literal is
// checked per-collection at compile time and `getCollection` can index it
// with zero `as unknown as` casts. Adding a collection to CrudCollectionName
// without registering it here is a compile error (the mapped type demands a
// key for every union member). Keep alphabetical to match the registry +
// crud method/publish registration order.
type CollectionMap = { readonly [K in CrudCollectionName]: Mongo.Collection<CrudCollectionMap[K]> };

const COLLECTIONS: CollectionMap = {
  attendances: AttendancesCollection,
  briefingTemplates: BriefingTemplatesCollection,
  discoveryTypes: DiscoveryTypesCollection,
  events: EventsCollection,
  eventTypes: EventTypesCollection,
  logs: LogsCollection,
  medals: MedalsCollection,
  members: MembersCollection,
  positions: PositionsCollection,
  profilePictures: ProfilePicturesCollection,
  questionnaireResponses: QuestionnaireResponsesCollection,
  questionnaires: QuestionnairesCollection,
  ranks: RanksCollection,
  registrations: RegistrationsCollection,
  roles: RolesCollection,
  specializations: SpecializationsCollection,
  squads: SquadsCollection,
  taskStatus: TaskStatusCollection,
  tasks: TasksCollection,
};

export function getCollection<K extends CrudCollectionName>(
  collection: K,
): Mongo.Collection<CrudCollectionMap[K]> {
  if (!collection) throw new Meteor.Error(400, 'No collection name');
  const found = COLLECTIONS[collection];
  if (!found) throw new Meteor.Error(404, `Collection "${collection}" not found`);
  return found;
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

// Registration id/age bounds — see imports/ui/registration/RegistrationForm.tsx,
// where these were previously enforced client-side only (#260). Kept as a
// constant so the rule reads the same on the server as on the form.
const REGISTRATION_ID_MIN = 1000;
const REGISTRATION_ID_MAX = 9999;
const REGISTRATION_MIN_AGE = 16;

// Per-collection insert-only validators, run inside the generic `.insert`
// validate hook after the shared shape check. Insert-only by design (#260): a
// crafted DDP insert must respect the same bounds as the form, but pre-existing
// out-of-range rows stay editable (update is intentionally not gated here).
// Registrations are the lone case today, so this stays a single inline entry
// rather than a registry field (Rule of Three).
const INSERT_VALIDATORS: Partial<Record<CrudCollectionName, (payload: Record<string, unknown>) => void>> = {
  registrations: payload => {
    const id = payload.id;
    if (typeof id !== 'number' || !Number.isInteger(id) || id < REGISTRATION_ID_MIN || id > REGISTRATION_ID_MAX) {
      throw new Meteor.Error('invalid-id', `Registration id must be an integer between ${REGISTRATION_ID_MIN} and ${REGISTRATION_ID_MAX}`);
    }
    const age = payload.age;
    if (typeof age !== 'number' || age < REGISTRATION_MIN_AGE) {
      throw new Meteor.Error('invalid-age', `Registration age must be at least ${REGISTRATION_MIN_AGE}`);
    }
  },
};

const DEFAULT_PUBLISH_LIMIT = 100;
const MAX_PUBLISH_LIMIT = 1000;

function createCollectionPublish(collection: CrudCollectionName): void {
  if (Meteor.isServer) {
    const Collection = getCollection(collection);
    const registryEntry = COLLECTION_REGISTRY[collection];
    const allowsAnonymousRead = registryEntry.allowsAnonymous?.read === true;
    // Async publish body so the permission check can await getUserRole.
    // Meteor 3 supports async publish handlers (see members.server.ts).
    Meteor.publish(collection, async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      if (!this.userId && !allowsAnonymousRead) return this.ready();
      validateObject(filter, false);
      validateObject(options, false);
      assertSafeSelector(filter);

      // Authorize the subscription unless the collection is explicitly anonymous-
      // readable. Previously any authenticated user could subscribe to any
      // collection regardless of their role's read permission (SEC-003).
      if (!allowsAnonymousRead) {
        const hasPermission = await checkPermission(this.userId, registryEntry.module, 'read');
        if (!hasPermission) {
          this.ready();
          throw new Meteor.Error(403, 'Permission denied');
        }
      }

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
                assertSafeSelector(f);
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
              validate: ([p]) => {
                validateObject(p, false);
                INSERT_VALIDATORS[collection]?.(p);
              },
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
              validate: ([f]) => {
                validateObject(f, false);
                assertSafeSelector(f);
              },
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
                assertSafeSelector(f);
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
