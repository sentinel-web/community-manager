import { Meteor } from 'meteor/meteor';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { checkPermission, validateUserId } from '../main';
import { getCollection } from '../crud.lib';
import { createLog } from './logs.server';
import { RATE_LIMITS } from '../config';

// Collections to backup (all data collections)
const BACKUP_COLLECTIONS = [
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

// Settings collection needs special handling (different import)
import SettingsCollection from '../../imports/api/collections/settings.collection';
import MembersCollection from '../../imports/api/collections/members.collection';

if (Meteor.isServer) {
  Meteor.methods({
    'backup.create': async function () {
      validateUserId(this.userId);

      // Check settings permission (backup requires settings access)
      const hasPermission = await checkPermission(this.userId, 'settings', 'read');
      if (!hasPermission) {
        throw new Meteor.Error(403, 'Permission denied. Settings access required for backup.');
      }

      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        appName: 'community-manager',
        collections: {},
        meta: {
          totalDocuments: 0,
          collectionCounts: {},
        },
      };

      // Export standard collections
      for (const collectionName of BACKUP_COLLECTIONS) {
        try {
          const Collection = getCollection(collectionName);
          const documents = await Collection.find({}).fetchAsync();
          backup.collections[collectionName] = documents;
          backup.meta.collectionCounts[collectionName] = documents.length;
          backup.meta.totalDocuments += documents.length;
        } catch (error) {
          await createLog('backup.export.error', { collection: collectionName, error: error.message });
          backup.collections[collectionName] = [];
          backup.meta.collectionCounts[collectionName] = 0;
        }
      }

      // Export settings collection (special handling)
      try {
        const settings = await SettingsCollection.find({}).fetchAsync();
        backup.collections.settings = settings;
        backup.meta.collectionCounts.settings = settings.length;
        backup.meta.totalDocuments += settings.length;
      } catch (error) {
        await createLog('backup.export.error', { collection: 'settings', error: error.message });
        backup.collections.settings = [];
        backup.meta.collectionCounts.settings = 0;
      }

      // Export users collection (Meteor.users / members)
      try {
        const users = await MembersCollection.find({}).fetchAsync();
        backup.collections.users = users;
        backup.meta.collectionCounts.users = users.length;
        backup.meta.totalDocuments += users.length;
      } catch (error) {
        await createLog('backup.export.error', { collection: 'users', error: error.message });
        backup.collections.users = [];
        backup.meta.collectionCounts.users = 0;
      }

      // Log the backup creation
      await createLog('backup.created', {
        userId: this.userId,
        totalDocuments: backup.meta.totalDocuments,
        collectionCounts: backup.meta.collectionCounts,
      });

      return backup;
    },

    // Quick backup for internal use (no audit log) - used for pre-restore safety backups
    'backup.createQuick': async function () {
      validateUserId(this.userId);

      const hasPermission = await checkPermission(this.userId, 'settings', 'read');
      if (!hasPermission) {
        throw new Meteor.Error(403, 'Permission denied. Settings access required for backup.');
      }

      const backup = {
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
          await createLog('backup.export.error', { collection: collectionName, error: error.message });
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
        await createLog('backup.export.error', { collection: 'settings', error: error.message });
        backup.collections.settings = [];
        backup.meta.collectionCounts.settings = 0;
      }

      try {
        const users = await MembersCollection.find({}).fetchAsync();
        backup.collections.users = users;
        backup.meta.collectionCounts.users = users.length;
        backup.meta.totalDocuments += users.length;
      } catch (error) {
        await createLog('backup.export.error', { collection: 'users', error: error.message });
        backup.collections.users = [];
        backup.meta.collectionCounts.users = 0;
      }

      // No audit log for quick backup
      return backup;
    },

    'backup.restore': async function (backupData, options = {}) {
      validateUserId(this.userId);
      const { createSafetyBackup = true } = options;

      // Check settings permission (restore requires settings access)
      const hasPermission = await checkPermission(this.userId, 'settings', 'read');
      if (!hasPermission) {
        throw new Meteor.Error(403, 'Permission denied. Settings access required for restore.');
      }

      // Validate backup structure
      if (!backupData || typeof backupData !== 'object') {
        throw new Meteor.Error(400, 'Invalid backup data');
      }

      if (!backupData.version || !backupData.collections) {
        throw new Meteor.Error(400, 'Invalid backup format. Missing version or collections.');
      }

      if (backupData.appName !== 'community-manager') {
        throw new Meteor.Error(400, 'Invalid backup. This backup is not from community-manager.');
      }

      // Create safety backup before restore if requested
      let safetyBackup = null;
      if (createSafetyBackup) {
        try {
          safetyBackup = await Meteor.callAsync('backup.createQuick');
        } catch (error) {
          await createLog('backup.safety.error', { error: error.message });
          throw new Meteor.Error(500, 'Failed to create safety backup before restore. Aborting restore.');
        }
      }

      const results = {
        success: true,
        restored: {},
        errors: [],
        safetyBackup,
      };

      // Restore standard collections
      for (const collectionName of BACKUP_COLLECTIONS) {
        if (backupData.collections[collectionName]) {
          try {
            const Collection = getCollection(collectionName);
            // Clear existing data
            await Collection.removeAsync({});
            // Insert backup data
            const documents = backupData.collections[collectionName];
            for (const doc of documents) {
              await Collection.insertAsync(doc);
            }
            results.restored[collectionName] = documents.length;
          } catch (error) {
            await createLog('backup.restore.error', { collection: collectionName, error: error.message });
            results.errors.push({ collection: collectionName, error: error.message });
          }
        }
      }

      // Restore settings collection
      if (backupData.collections.settings) {
        try {
          await SettingsCollection.removeAsync({});
          for (const doc of backupData.collections.settings) {
            await SettingsCollection.insertAsync(doc);
          }
          results.restored.settings = backupData.collections.settings.length;
        } catch (error) {
          await createLog('backup.restore.error', { collection: 'settings', error: error.message });
          results.errors.push({ collection: 'settings', error: error.message });
        }
      }

      // Restore users collection
      if (backupData.collections.users) {
        try {
          // Don't delete the current user to prevent lockout
          const currentUserId = this.userId;
          await MembersCollection.removeAsync({ _id: { $ne: currentUserId } });
          for (const doc of backupData.collections.users) {
            // Skip the current user (already exists)
            if (doc._id === currentUserId) continue;
            try {
              await MembersCollection.insertAsync(doc);
            } catch (insertError) {
              // Skip if user already exists (duplicate key)
              if (!insertError.message.includes('duplicate key')) {
                throw insertError;
              }
            }
          }
          results.restored.users = backupData.collections.users.length;
        } catch (error) {
          await createLog('backup.restore.error', { collection: 'users', error: error.message });
          results.errors.push({ collection: 'users', error: error.message });
        }
      }

      // Log the restore operation
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

    'backup.validate': async function (backupData) {
      validateUserId(this.userId);

      // Check settings permission
      const hasPermission = await checkPermission(this.userId, 'settings', 'read');
      if (!hasPermission) {
        throw new Meteor.Error(403, 'Permission denied. Settings access required for backup validation.');
      }

      // Validate backup structure
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

      // Return validation result with stats
      return {
        valid: true,
        version: backupData.version,
        timestamp: backupData.timestamp,
        meta: backupData.meta,
      };
    },
  });

  // Rate limiting for backup operations (configurable via Meteor.settings)
  DDPRateLimiter.addRule(
    {
      type: 'method',
      name: 'backup.create',
      userId: () => true,
    },
    RATE_LIMITS.backup.create.count,
    RATE_LIMITS.backup.create.intervalMs
  );

  DDPRateLimiter.addRule(
    {
      type: 'method',
      name: 'backup.restore',
      userId: () => true,
    },
    RATE_LIMITS.backup.restore.count,
    RATE_LIMITS.backup.restore.intervalMs
  );

  DDPRateLimiter.addRule(
    {
      type: 'method',
      name: 'backup.createQuick',
      userId: () => true,
    },
    RATE_LIMITS.backup.createQuick.count,
    RATE_LIMITS.backup.createQuick.intervalMs
  );
}
