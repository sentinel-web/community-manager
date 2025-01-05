import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';
import { validateDate, validateObject, validatePublish, validateString, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('events', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return EventsCollection.find(filter, options);
  });

  Meteor.methods({
    'events.insert': async function ({ name = '', start = new Date() } = {}) {
      validateUserId(this.userId);
      validateString(name, true);
      validateDate(start, true);
      try {
        return await EventsCollection.insertAsync({ name, start });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'events.update': async function (eventId = '', data = {}) {
      validateUserId(this.userId);
      validateString(eventId, true);
      validateObject(data, true);
      const event = await EventsCollection.findOneAsync(eventId);
      validateObject(event, true);
      try {
        return await EventsCollection.updateAsync({ _id: eventId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'events.remove': async function (eventId = '') {
      validateUserId(this.userId);
      validateString(eventId, true);
      const event = await EventsCollection.findOneAsync(eventId);
      validateObject(event, true);
      try {
        return await EventsCollection.removeAsync({ _id: eventId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
