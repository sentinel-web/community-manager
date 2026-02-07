import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import { validateUserId, validateString } from '../main';
import { createLog } from './logs.server';

const getFullName = (rank, id, name) => `${rank || 'Unranked'}-${id || '0000'} ${name || 'Name'}`;

async function resolveNames(userIds) {
  if (!userIds?.length) return [];
  const members = await MembersCollection.find({ _id: { $in: userIds } }, { fields: { 'profile.rankId': 1, 'profile.id': 1, 'profile.name': 1 } }).fetchAsync();
  const rankIds = [...new Set(members.map(m => m.profile?.rankId).filter(Boolean))];
  const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
  const rankMap = new Map(ranks.map(r => [r._id, r.name]));
  return members.map(m => ({
    _id: m._id,
    name: getFullName(rankMap.get(m.profile?.rankId), m.profile?.id, m.profile?.name),
  }));
}

if (Meteor.isServer) {
  Meteor.methods({
    'events.rsvp': async function (eventId) {
      validateUserId(this.userId);
      validateString(eventId);

      const event = await EventsCollection.findOneAsync(eventId);
      if (!event) throw new Meteor.Error(404, 'Event not found');

      const attendees = event.attendees || [];
      const isSignedUp = attendees.includes(this.userId);

      if (isSignedUp) {
        await EventsCollection.updateAsync(eventId, { $pull: { attendees: this.userId } });
        await createLog('event.rsvp.removed', { eventId, userId: this.userId });
      } else {
        await EventsCollection.updateAsync(eventId, { $addToSet: { attendees: this.userId } });
        await createLog('event.rsvp.added', { eventId, userId: this.userId });
      }

      return !isSignedUp;
    },
    'events.detail': async function (eventId) {
      validateUserId(this.userId);
      validateString(eventId);

      const event = await EventsCollection.findOneAsync(eventId);
      if (!event) throw new Meteor.Error(404, 'Event not found');

      const eventType = event.eventType ? await EventTypesCollection.findOneAsync(event.eventType) : null;
      const hosts = await resolveNames(event.hosts);
      const attendees = await resolveNames(event.attendees);

      return {
        ...event,
        eventTypeName: eventType?.name || null,
        eventTypeColor: eventType?.color || null,
        resolvedHosts: hosts,
        resolvedAttendees: attendees,
        isSignedUp: (event.attendees || []).includes(this.userId),
      };
    },
  });
}
