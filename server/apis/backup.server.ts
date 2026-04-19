import { Meteor } from 'meteor/meteor';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { checkPermission, validateUserId } from '../main';
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

      for (const collectionName of BACKUP_COLLECTIONS) {
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
      }

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

      for (const collectionName of BACKUP_COLLECTIONS) {
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
      }

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

      const hasPermission = await checkPermission(this.userId, 'settings', 'read');
      if (!hasPermission) {
        throw new Meteor.Error(403, 'Permission denied. Settings access required for restore.');
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

      for (const collectionName of BACKUP_COLLECTIONS) {
        if (backupData.collections[collectionName]) {
          try {
            const Collection = getCollection(collectionName);
            await Collection.removeAsync({});
            const documents = backupData.collections[collectionName];
            for (const doc of documents) {
              await Collection.insertAsync(doc as never);
            }
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
          for (const doc of backupData.collections.settings) {
            await SettingsCollection.insertAsync(doc as never);
          }
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
          for (const doc of backupData.collections.users as Array<{ _id: string }>) {
            if (doc._id === currentUserId) continue;
            try {
              await MembersCollection.insertAsync(doc as never);
            } catch (insertError) {
              if (!(insertError as Error).message.includes('duplicate key')) {
                throw insertError;
              }
            }
          }
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
