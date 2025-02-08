import { Meteor } from 'meteor/meteor';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { validateObject, validateString, validateUserId } from '../main';

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
        return await SettingsCollection.upsertAsync(key, { $set: { key, value } });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'settings.remove': async function (key = null) {
      validateUserId(this.userId);
      try {
        return await SettingsCollection.removeAsync(key);
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'settings.findOne': async (filter = {}) => {
      validateString(filter, false);
      try {
        const setting = await SettingsCollection.findOneAsync(filter);
        return setting.value;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
