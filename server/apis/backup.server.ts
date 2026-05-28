import { Meteor } from 'meteor/meteor';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { checkPermission, getUserRole, isOfficerOrAdmin, validateUserId } from '../main';
import { getCollection } from '../crud.lib';
import { createLog } from './logs.server';
import { RATE_LIMITS } from '../config';
import type { CrudCollectionName } from '/imports/api/types';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import MembersCollection from '../../imports/api/collections/members.collection';

const BACKUP_COLLECTIONS: readonly CrudCollectionName[] = [
  'attendances',
  'events',
  'eventTypes',
  'briefingTemplates',
  'tasks',
  'taskStatus',
  'squads',
  'ranks',
  'specializations',
  'medals',
  'registrations',
  'discoveryTypes',
  'roles',
  'profilePictures',
  'logs',
];

interface BackupMeta {
  totalDocuments: number;
  collectionCounts: Record<string, number>;
  isSafetyBackup?: boolean;
}

interface BackupData {
  version: string;
  timestamp: string;
  appName: string;
  collections: Record<string, unknown[]>;
  meta: BackupMeta;
}

interface RestoreResult {
  success: boolean;
  restored: Record<string, number>;
  errors: Array<{ collection: string; error: string }>;
  safetyBackup: BackupData | null;
}

// SEC-004 hardening: restore is the single most privilege-sensitive operation
// in the app — it can rewrite the `users` and `roles` collections wholesale.
// Before SEC-004 it inserted attacker-controlled documents verbatim, so a
// `settings`-read user could upload a backup whose own user doc carried
// `roles: true` (or arbitrary `services`) and self-promote to admin
// (CWE-502/915/284). The hardening below:
//   1. Requires full admin to restore (see method body). `settings` is a
//      *boolean* module (server/main.ts BOOLEAN_MODULES), so checkPermission
//      with operation 'update' is identical to 'read' and would NOT have
//      strengthened anything — hence an explicit admin gate instead.
//   2. Validates every document of every collection up front, refusing any
//      `users` doc that carries credential/privilege fields (`services`,
//      `roles`) or unexpected top-level keys.
//   3. Validates the whole payload before touching the DB, so a malformed
//      backup aborts with zero mutations.

// Top-level keys we accept on a restored user document. `services`
// (credentials) and `roles` (embedded permission grant) are deliberately
// absent: the app assigns roles via `profile.roleId`, never an embedded
// `roles` field, and credentials are never carried in a backup.
const ALLOWED_USER_KEYS: readonly string[] = ['_id', 'username', 'profile', 'createdAt', 'emails'];
const FORBIDDEN_USER_KEYS: readonly string[] = ['services', 'roles'];

class RestoreValidationError extends Meteor.Error {
  constructor(collection: string, index: number, reason: string) {
    super(400, `Invalid backup: ${collection}[${index}] ${reason}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Validates a single restored user document. Throws RestoreValidationError on
// any credential/privilege field or unexpected top-level key. This is the core
// privilege-escalation guard for SEC-004.
function validateRestoreUser(doc: unknown, index: number): void {
  if (!isPlainObject(doc)) {
    throw new RestoreValidationError('users', index, 'is not an object');
  }
  if (typeof doc._id !== 'string' || doc._id.length === 0) {
    throw new RestoreValidationError('users', index, 'has a missing or non-string _id');
  }
  for (const forbidden of FORBIDDEN_USER_KEYS) {
    if (forbidden in doc) {
      throw new RestoreValidationError('users', index, `carries forbidden privilege/credential field "${forbidden}"`);
    }
  }
  for (const key of Object.keys(doc)) {
    if (!ALLOWED_USER_KEYS.includes(key)) {
      throw new RestoreValidationError('users', index, `carries unexpected field "${key}"`);
    }
  }
  if ('username' in doc && typeof doc.username !== 'string') {
    throw new RestoreValidationError('users', index, 'has a non-string username');
  }
  if ('profile' in doc && !isPlainObject(doc.profile)) {
    throw new RestoreValidationError('users', index, 'has a non-object profile');
  }
  // A `roles: true` grant cannot ride in via profile either.
  if (isPlainObject(doc.profile) && 'roles' in doc.profile) {
    throw new RestoreValidationError('users', index, 'carries forbidden privilege field "profile.roles"');
  }
}

// Structural validation for every other collection: each document must be a
// plain object with a string _id so wipe-then-insert is deterministic. The
// `roles` collection is intentionally NOT specially guarded here because
// restore now requires full admin (an admin can already mint any role); the
// _id/object check still rejects malformed payloads.
function validateRestoreDocument(collectionName: string, doc: unknown, index: number): void {
  if (collectionName === 'users') {
    validateRestoreUser(doc, index);
    return;
  }
  if (!isPlainObject(doc)) {
    throw new RestoreValidationError(collectionName, index, 'is not an object');
  }
  if (typeof doc._id !== 'string' || doc._id.length === 0) {
    throw new RestoreValidationError(collectionName, index, 'has a missing or non-string _id');
  }
}

// Validates the entire backup payload before any DB mutation. Throwing here
// leaves the database untouched (the safety-backup, created earlier, is the
// belt-and-braces recovery path). `collections` may carry collection names we
// don't restore — those are ignored, mirroring the restore loop below.
function validateRestorePayload(collections: Record<string, unknown[]>): void {
  const restorable = [...BACKUP_COLLECTIONS, 'settings', 'users'];
  for (const collectionName of restorable) {
    const documents = collections[collectionName];
    if (!documents) continue;
    if (!Array.isArray(documents)) {
      throw new Meteor.Error(400, `Invalid backup: "${collectionName}" is not an array of documents.`);
    }
    documents.forEach((doc, index) => validateRestoreDocument(collectionName, doc, index));
  }
}

if (Meteor.isServer) {
  Meteor.methods({
    'backup.create': async function (): Promise<BackupData> {
      validateUserId(this.userId);

      const hasPermission = await checkPermission(this.userId, 'settings', 'read');
      if (!hasPermission) {
        throw new Meteor.Error(403, 'Permission denied. Settings access required for backup.');
      }

      const backup: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        appName: 'community-manager',
        collections: {},
        meta: {
          totalDocuments: 0,
          collectionCounts: {},
        },
      };

      // Every collection fetch is independent — race them through
      // Promise.all instead of waterfalling. Mutations to the shared
      // `backup` object are safe under interleaved awaits because JS is
      // single-threaded between yield points, and each iteration writes
      // disjoint keys (totalDocuments uses `+=`, atomic in JS).
      await Promise.all(BACKUP_COLLECTIONS.map(async collectionName => {
        try {
          const Collection = getCollection(collectionName);
          const documents = await Collection.find({}).fetchAsync();
          backup.collections[collectionName] = documents;
          backup.meta.collectionCounts[collectionName] = documents.length;
          backup.meta.totalDocuments += documents.length;
        } catch (error) {
          await createLog('backup.export.error', { collection: collectionName, error: (error as Error).message });
          backup.collections[collectionName] = [];
          backup.meta.collectionCounts[collectionName] = 0;
        }
      }));

      try {
        const settings = await SettingsCollection.find({}).fetchAsync();
        backup.collections.settings = settings;
        backup.meta.collectionCounts.settings = settings.length;
        backup.meta.totalDocuments += settings.length;
      } catch (error) {
        await createLog('backup.export.error', { collection: 'settings', error: (error as Error).message });
        backup.collections.settings = [];
        backup.meta.collectionCounts.settings = 0;
      }

      try {
        const users = await MembersCollection.find({}).fetchAsync();
        backup.collections.users = users;
        backup.meta.collectionCounts.users = users.length;
        backup.meta.totalDocuments += users.length;
      } catch (error) {
        await createLog('backup.export.error', { collection: 'users', error: (error as Error).message });
        backup.collections.users = [];
        backup.meta.collectionCounts.users = 0;
      }

      await createLog('backup.created', {
        userId: this.userId,
        totalDocuments: backup.meta.totalDocuments,
        collectionCounts: backup.meta.collectionCounts,
      });

      return backup;
    },

    'backup.createQuick': async function (): Promise<BackupData> {
      validateUserId(this.userId);

      const hasPermission = await checkPermission(this.userId, 'settings', 'read');
      if (!hasPermission) {
        throw new Meteor.Error(403, 'Permission denied. Settings access required for backup.');
      }

      const backup: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        appName: 'community-manager',
        collections: {},
        meta: {
          totalDocuments: 0,
          collectionCounts: {},
          isSafetyBackup: true,
        },
      };

      // See parallelization rationale on backup.create above — same pattern.
      await Promise.all(BACKUP_COLLECTIONS.map(async collectionName => {
        try {
          const Collection = getCollection(collectionName);
          const documents = await Collection.find({}).fetchAsync();
          backup.collections[collectionName] = documents;
          backup.meta.collectionCounts[collectionName] = documents.length;
          backup.meta.totalDocuments += documents.length;
        } catch (error) {
          await createLog('backup.export.error', { collection: collectionName, error: (error as Error).message });
          backup.collections[collectionName] = [];
          backup.meta.collectionCounts[collectionName] = 0;
        }
      }));

      try {
        const settings = await SettingsCollection.find({}).fetchAsync();
        backup.collections.settings = settings;
        backup.meta.collectionCounts.settings = settings.length;
        backup.meta.totalDocuments += settings.length;
      } catch (error) {
        await createLog('backup.export.error', { collection: 'settings', error: (error as Error).message });
        backup.collections.settings = [];
        backup.meta.collectionCounts.settings = 0;
      }

      try {
        const users = await MembersCollection.find({}).fetchAsync();
        backup.collections.users = users;
        backup.meta.collectionCounts.users = users.length;
        backup.meta.totalDocuments += users.length;
      } catch (error) {
        await createLog('backup.export.error', { collection: 'users', error: (error as Error).message });
        backup.collections.users = [];
        backup.meta.collectionCounts.users = 0;
      }

      return backup;
    },

    'backup.restore': async function (backupData: BackupData | null, options: { createSafetyBackup?: boolean } = {}): Promise<RestoreResult> {
      validateUserId(this.userId);
      const { createSafetyBackup = true } = options;

      // SEC-004: restore can rewrite users/roles wholesale, so it requires full
      // admin — not merely `settings` access. `settings` is a boolean module,
      // so checkPermission(..., 'update') would be identical to 'read' and would
      // not have closed the privilege-escalation hole. Gate on admin instead.
      const role = await getUserRole(this.userId);
      if (!isOfficerOrAdmin(role)) {
        await createLog('backup.restore.denied', { userId: this.userId });
        throw new Meteor.Error(403, 'Permission denied. Administrator access is required to restore a backup.');
      }

      if (!backupData || typeof backupData !== 'object') {
        throw new Meteor.Error(400, 'Invalid backup data');
      }

      if (!backupData.version || !backupData.collections) {
        throw new Meteor.Error(400, 'Invalid backup format. Missing version or collections.');
      }

      if (backupData.appName !== 'community-manager') {
        throw new Meteor.Error(400, 'Invalid backup. This backup is not from community-manager.');
      }

      // Validate the entire payload BEFORE wiping anything. A malformed backup —
      // or one attempting to smuggle credential/privilege fields into `users` —
      // aborts here with zero DB mutations (fail-before-write).
      validateRestorePayload(backupData.collections);

      let safetyBackup: BackupData | null = null;
      if (createSafetyBackup) {
        try {
          safetyBackup = await Meteor.callAsync('backup.createQuick');
        } catch (error) {
          await createLog('backup.safety.error', { error: (error as Error).message });
          throw new Meteor.Error(500, 'Failed to create safety backup before restore. Aborting restore.');
        }
      }

      const results: RestoreResult = {
        success: true,
        restored: {},
        errors: [],
        safetyBackup,
      };

      // Outer loop stays sequential — inserting collections in declared order
      // preserves any implicit FK ordering. Inner inserts are parallelized
      // because every doc within a collection is independent (fixed _ids,
      // no intra-collection ordering dependency).
      for (const collectionName of BACKUP_COLLECTIONS) {
        if (backupData.collections[collectionName]) {
          try {
            const Collection = getCollection(collectionName);
            await Collection.removeAsync({});
            const documents = backupData.collections[collectionName];
            await Promise.all(documents.map(doc => Collection.insertAsync(doc as never)));
            results.restored[collectionName] = documents.length;
          } catch (error) {
            await createLog('backup.restore.error', { collection: collectionName, error: (error as Error).message });
            results.errors.push({ collection: collectionName, error: (error as Error).message });
          }
        }
      }

      if (backupData.collections.settings) {
        try {
          await SettingsCollection.removeAsync({});
          await Promise.all(backupData.collections.settings.map(doc => SettingsCollection.insertAsync(doc as never)));
          results.restored.settings = backupData.collections.settings.length;
        } catch (error) {
          await createLog('backup.restore.error', { collection: 'settings', error: (error as Error).message });
          results.errors.push({ collection: 'settings', error: (error as Error).message });
        }
      }

      if (backupData.collections.users) {
        try {
          const currentUserId = this.userId;
          await MembersCollection.removeAsync({ _id: { $ne: currentUserId } } as never);
          // Per-doc try/catch swallows duplicate-key errors (the current user
          // is left in place pre-wipe, so a backup containing their id would
          // otherwise reject). Promise.all preserves that behavior because
          // each map callback owns its own try/catch.
          await Promise.all(
            (backupData.collections.users as Array<{ _id: string }>).map(async doc => {
              if (doc._id === currentUserId) return;
              try {
                await MembersCollection.insertAsync(doc as never);
              } catch (insertError) {
                if (!(insertError as Error).message.includes('duplicate key')) {
                  throw insertError;
                }
              }
            }),
          );
          results.restored.users = backupData.collections.users.length;
        } catch (error) {
          await createLog('backup.restore.error', { collection: 'users', error: (error as Error).message });
          results.errors.push({ collection: 'users', error: (error as Error).message });
        }
      }

      await createLog('backup.restored', {
        userId: this.userId,
        backupTimestamp: backupData.timestamp,
        restored: results.restored,
        errors: results.errors,
      });

      if (results.errors.length > 0) {
        results.success = false;
      }

      return results;
    },

    'backup.validate': async function (backupData: BackupData | null) {
      validateUserId(this.userId);

      const hasPermission = await checkPermission(this.userId, 'settings', 'read');
      if (!hasPermission) {
        throw new Meteor.Error(403, 'Permission denied. Settings access required for backup validation.');
      }

      if (!backupData || typeof backupData !== 'object') {
        return { valid: false, error: 'Invalid backup data' };
      }

      if (!backupData.version) {
        return { valid: false, error: 'Missing version field' };
      }

      if (!backupData.collections) {
        return { valid: false, error: 'Missing collections field' };
      }

      if (backupData.appName !== 'community-manager') {
        return { valid: false, error: 'Backup is not from community-manager' };
      }

      return {
        valid: true,
        version: backupData.version,
        timestamp: backupData.timestamp,
        meta: backupData.meta,
      };
    },
  });

  DDPRateLimiter.addRule(
    {
      type: 'method',
      name: 'backup.create',
      userId: () => true,
    },
    RATE_LIMITS.backup.create.count,
    RATE_LIMITS.backup.create.intervalMs,
  );

  DDPRateLimiter.addRule(
    {
      type: 'method',
      name: 'backup.restore',
      userId: () => true,
    },
    RATE_LIMITS.backup.restore.count,
    RATE_LIMITS.backup.restore.intervalMs,
  );

  DDPRateLimiter.addRule(
    {
      type: 'method',
      name: 'backup.createQuick',
      userId: () => true,
    },
    RATE_LIMITS.backup.createQuick.count,
    RATE_LIMITS.backup.createQuick.intervalMs,
  );
}
