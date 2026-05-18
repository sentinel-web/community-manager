import { Meteor } from 'meteor/meteor';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { validateObject, validateString, validateUserId, checkPermission } from '../main';
import { createLog } from './logs.server';
import { decrypt, encrypt } from '../encryption';
import { reloadDiscordBot } from '../discord/bot';

const PUBLIC_SETTING_KEYS = ['community-title', 'community-logo', 'community-color'];

if (Meteor.isServer) {
  Meteor.publish('settings.public', function () {
    return SettingsCollection.find({ key: { $in: PUBLIC_SETTING_KEYS } });
  });

  Meteor.publish('settings', function (filter = {}, options = {}) {
    validateUserId(this.userId);
    validateObject(filter, false);
    validateObject(options, false);
    const handle = SettingsCollection.find(filter, options).observe({
      added: (doc) => {
        const d = { ...doc };
        if (d.key === 'discord-bot-token' && typeof d.value === 'string') {
          d.value = decrypt(d.value); // Entschlüsselung für den Client
        }
        this.added('settings', doc._id, d);
      },
      changed: (newDoc) => {
        const d = { ...newDoc };
        if (d.key === 'discord-bot-token' && typeof d.value === 'string') {
          d.value = decrypt(d.value);
        }
        this.changed('settings', newDoc._id, d);
      },
      removed: (oldDoc) => {
        this.removed('settings', oldDoc._id);
      }
    });
  
    this.ready();
    this.onStop(() => {
      if (handle && typeof handle.stop === 'function') {
        handle.stop();
      }
    });
  //  return SettingsCollection.find(filter, options);
  });

  Meteor.methods({
    'settings.upsert': async function (key: string = '', value: unknown) {
      validateUserId(this.userId);
      const hasPermission = await checkPermission(this.userId, 'settings');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
      validateString(key, false);
      if (value === null || value === undefined) {
        throw new Meteor.Error('invalid-value', 'Invalid value');
      }
      let processedValue = value;
      if (key === 'discord-bot-token' && typeof value === 'string') {
        processedValue = encrypt(value);
      }
      const result = await SettingsCollection.upsertAsync(
        { key }, 
        { $set: { key, value: processedValue } }
      );
      if (key.startsWith('discord-')) {
        try {
          reloadDiscordBot().catch(console.error);
          await SettingsCollection.upsertAsync({ key: 'discord-error-message' }, { $set: { key: 'discord-error-message', value: null } });
        } catch (error) {
          const errMsg = (error as Error).message;
          await SettingsCollection.upsertAsync({ key: 'discord-error-message' }, { $set: { key: 'discord-error-message', value: errMsg } });
        }
        
      }
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
      if (!setting) return undefined;

      // Entschlüsseln, falls es der Bot-Token ist
      if (key === 'discord-bot-token' && typeof setting.value === 'string') {
        return decrypt(setting.value);
      }

      return setting.value;
    },
  });
}
