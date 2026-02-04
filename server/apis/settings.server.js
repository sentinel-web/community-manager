import { Meteor } from 'meteor/meteor';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { validateObject, validateString, validateUserId } from '../main';
import { createLog } from './logs.server';

if (Meteor.isServer) {
  Meteor.publish('settings', (filter = {}, options = {}) => {
    validateObject(filter, false);
    validateObject(options, false);
    return SettingsCollection.find(filter, options);
  });

  Meteor.methods({
    'settings.upsert': async function (key, value) {
      validateUserId(this.userId);
      validateString(key, false);
      if (!value) {
        throw new Meteor.Error('invalid-value', 'Invalid value', value);
      }
      try {
        const result = await SettingsCollection.upsertAsync(key, { $set: { key, value } });
        await createLog('settings.updated', { key });
        return result;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'settings.remove': async function (key = null) {
      validateUserId(this.userId);
      try {
        const result = await SettingsCollection.removeAsync(key);
        await createLog('settings.deleted', { key });
        return result;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'settings.findOne': async (filter = {}) => {
      validateString(filter, false);
      try {
        const setting = await SettingsCollection.findOneAsync(filter);
        if (!setting) throw new Meteor.Error(404, 'Setting not found');
        return setting.value;
      } catch (error) {
        if (error.error === 404) throw error;
        throw new Meteor.Error(error.message);
      }
    },
  });
}
