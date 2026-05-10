import { Meteor } from 'meteor/meteor';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { validateObject, validateString, validateUserId, checkPermission } from '../main';
import { createLog } from './logs.server';

const PUBLIC_SETTING_KEYS = ['community-title', 'community-logo', 'community-color'];

if (Meteor.isServer) {
  Meteor.publish('settings.public', function () {
    return SettingsCollection.find({ key: { $in: PUBLIC_SETTING_KEYS } });
  });

  Meteor.publish('settings', function (filter = {}, options = {}) {
    validateUserId(this.userId);
    validateObject(filter, false);
    validateObject(options, false);
    return SettingsCollection.find(filter, options);
  });

  Meteor.methods({
    'settings.upsert': async function (key: string = '', value: unknown) {
      validateUserId(this.userId);
      const hasPermission = await checkPermission(this.userId, 'settings');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
      validateString(key, false);
      if (value === null || value === undefined) {
        throw new Meteor.Error('invalid-value', 'Invalid value', value as never);
      }
      const result = await SettingsCollection.upsertAsync(key, { $set: { key, value } });
      await createLog('settings.updated', { key });
      return result;
    },
    'settings.remove': async function (key: string = '') {
      validateUserId(this.userId);
      const hasPermission = await checkPermission(this.userId, 'settings');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
      validateString(key, false);
      const result = await SettingsCollection.removeAsync({ key });
      await createLog('settings.deleted', { key });
      return result;
    },
    'settings.findOne': async function (key: string = '') {
      validateUserId(this.userId);
      const hasPermission = await checkPermission(this.userId, 'settings');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
      validateString(key, false);
      const setting = await SettingsCollection.findOneAsync({ key });
      return setting?.value;
    },
  });
}
