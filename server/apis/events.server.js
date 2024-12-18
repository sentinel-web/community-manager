import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';

if (Meteor.isServer) {
  Meteor.publish('events', function (filter = {}, options = {}) {
    if (!this.userId) {
      return [];
    }
    return EventsCollection.find(filter, options);
  });

  Meteor.methods({
    'events.insert': async function ({ name = '', start = new Date() } = {}) {
      if (!name || typeof name !== 'string') {
        throw new Meteor.Error('invalid-name', 'Invalid name', name);
      }
      if (!start || typeof start !== 'object') {
        throw new Meteor.Error('invalid-start', 'Invalid start', start);
      }
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }
      try {
        return await EventsCollection.insertAsync({ name, start });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'events.update': async function (eventId = '', data = {}) {
      if (!eventId || typeof eventId !== 'string') {
        throw new Meteor.Error('invalid-event-id', 'Invalid event ID', eventId);
      }
      if (!data || typeof data !== 'object') {
        throw new Meteor.Error('invalid-data', 'Invalid data', data);
      }
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }
      const event = await EventsCollection.findOneAsync(eventId);
      if (event) {
        try {
          return await EventsCollection.updateAsync({ _id: eventId }, { $set: data });
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      } else {
        throw new Meteor.Error('event-not-found');
      }
    },
    'events.remove': async function (eventId = '') {
      if (!eventId || typeof eventId !== 'string') {
        throw new Meteor.Error('invalid-event-id', 'Invalid event ID', eventId);
      }
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }
      const event = await EventsCollection.findOneAsync(eventId);
      if (event) {
        try {
          return await EventsCollection.removeAsync({ _id: eventId });
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      } else {
        throw new Meteor.Error('event-not-found');
      }
    },
  });
}
