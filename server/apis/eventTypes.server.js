import { Meteor } from 'meteor/meteor';
import { validateObject, validatePublish, validateString, validateUserId } from '../main';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';

if (Meteor.isServer) {
  Meteor.publish('eventTypes', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return EventTypesCollection.find(filter, options);
  });

  Meteor.methods({
    'eventTypes.insert': async function ({ name = '', color = '', description = '' } = {}) {
      validateUserId(this.userId);
      validateString(name, true);
      validateString(color, false);
      validateString(description, false);
      try {
        return await EventTypesCollection.insertAsync({ name, color, description });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'eventTypes.update': async function (eventTypeId = '', data = {}) {
      validateUserId(this.userId);
      validateString(eventTypeId, true);
      validateObject(data, true);
      const eventType = await EventTypesCollection.findOneAsync(eventTypeId);
      validateObject(eventType, true);
      try {
        return await EventTypesCollection.updateAsync({ _id: eventTypeId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'eventTypes.remove': async function (eventTypeId = '') {
      validateUserId(this.userId);
      validateString(eventTypeId, true);
      const eventType = await EventTypesCollection.findOneAsync(eventTypeId);
      validateObject(eventType, true);
      try {
        return await EventTypesCollection.removeAsync({ _id: eventTypeId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'eventTypes.options': async function () {
      validateUserId(this.userId);
      try {
        const eventTypes = await EventTypesCollection.find().fetchAsync();
        const options = [];
        for (const eventType of eventTypes) {
          options.push({
            label: eventType.name,
            value: eventType._id,
            title: eventType.description,
            raw: eventType,
          });
        }
        return options;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
