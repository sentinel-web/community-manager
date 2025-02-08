import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';
import { validateArrayOfStrings, validateBoolean, validateDate, validateObject, validatePublish, validateString, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('events', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return EventsCollection.find(filter, options);
  });

  Meteor.methods({
    'events.insert': async function ({
      start = new Date(),
      end = new Date(),
      name = '',
      description = '',
      preset = '',
      hosts = [],
      attendees = [],
      eventType = '',
      isPrivate = false,
    } = {}) {
      validateUserId(this.userId);
      validateString(name, false);
      validateDate(start, false);
      validateDate(end, false);
      validateString(eventType, true);
      validateString(description, true);
      validateString(preset, true);
      validateArrayOfStrings(hosts, true);
      validateArrayOfStrings(attendees, true);
      validateBoolean(isPrivate, true);
      try {
        return await EventsCollection.insertAsync({ start, end, name, description, preset, hosts, attendees, eventType, isPrivate });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'events.update': async function (eventId = '', data = {}) {
      validateUserId(this.userId);
      validateString(eventId, false);
      validateObject(data, false);
      const event = await EventsCollection.findOneAsync(eventId);
      validateObject(event, false);
      try {
        return await EventsCollection.updateAsync({ _id: eventId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'events.remove': async function (eventId = '') {
      validateUserId(this.userId);
      validateString(eventId, false);
      const event = await EventsCollection.findOneAsync(eventId);
      validateObject(event, false);
      try {
        return await EventsCollection.removeAsync({ _id: eventId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
