import { Meteor } from 'meteor/meteor';
import LogsCollection from '../../imports/api/collections/logs.collection';
import { validateObject, validateString, validateUserId } from '../main';

export async function createLog(action, payload = {}) {
  const now = new Date();
  return await LogsCollection.insertAsync({
    action,
    timestamp: now,
    payload,
    createdAt: now,
  });
}

if (Meteor.isServer) {
  Meteor.publish('logs', function (filter = {}, options = {}) {
    validateUserId(this.userId);
    validateObject(filter, false);
    validateObject(options, false);
    return LogsCollection.find(filter, options);
  });

  Meteor.methods({
    'logs.read': async function (filter = {}, options = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);
      return await LogsCollection.find(filter, options).fetchAsync();
    },
    'logs.insert': async function (payload = {}) {
      if (this.connection !== null) {
        throw new Meteor.Error(403, 'Forbidden', 'Logs can only be created server-side');
      }
      validateObject(payload, false);
      const now = new Date();
      return await LogsCollection.insertAsync({
        ...payload,
        createdAt: now,
      });
    },
    'logs.remove': async function (id = '') {
      validateUserId(this.userId);
      validateString(id, false);
      const doc = await LogsCollection.findOneAsync(id);
      if (!doc) throw new Meteor.Error(404, 'Log not found');
      return await LogsCollection.removeAsync({ _id: id });
    },
    'logs.count': async function (filter = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      return await LogsCollection.countDocuments(filter);
    },
  });
}
