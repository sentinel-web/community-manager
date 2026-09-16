import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import { getEventVisibilityFilter, withEventVisibility } from '../event-visibility';
import { validateUserId, validateString, validateObject } from '../main';
import { createLog } from './logs.server';

const getFullName = (rank: string | undefined, id: number | undefined, name: string | undefined): string =>
  `${rank || 'Unranked'}-${id || '0000'} ${name || 'Name'}`;

interface ResolvedMember {
  _id: string;
  name: string;
}

async function resolveNames(userIds: string[] | undefined): Promise<ResolvedMember[]> {
  if (!userIds?.length) return [];
  const members = await MembersCollection.find({ _id: { $in: userIds } }, { fields: { 'profile.rankId': 1, 'profile.id': 1, 'profile.name': 1 } }).fetchAsync();
  const rankIds = [...new Set(members.flatMap(m => m.profile?.rankId ? [m.profile.rankId] : []))];
  const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
  const rankMap = new Map(ranks.map(r => [r._id, r.name]));
  return members.map(m => ({
    _id: m._id,
    name: getFullName(rankMap.get(m.profile?.rankId as string), m.profile?.id, m.profile?.name),
  }));
}

// Loads an event the caller may see, applying the shared private-event filter
// (server/event-visibility.ts) that also gates the `events` publication, the
// generated `events.read`/`.count`/`.options` methods, and `palette.search`.
// Invisible events are reported exactly like missing ones (404), so private
// event ids can't be probed.
async function findVisibleEvent(userId: string, eventId: string) {
  const visibility = await getEventVisibilityFilter(userId);
  const event = await EventsCollection.findOneAsync(withEventVisibility({ _id: eventId }, visibility));
  if (!event) throw new Meteor.Error(404, 'Event not found');
  return event;
}

const DEFAULT_PUBLISH_LIMIT = 100;
const MAX_PUBLISH_LIMIT = 1000;

if (Meteor.isServer) {
  Meteor.publish('events', async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
    if (!this.userId) return this.ready();
    validateObject(filter, false);
    validateObject(options, false);

    const limitedOptions: Record<string, unknown> = { ...options };
    if (!limitedOptions.limit) {
      limitedOptions.limit = DEFAULT_PUBLISH_LIMIT;
    } else if ((limitedOptions.limit as number) > MAX_PUBLISH_LIMIT) {
      limitedOptions.limit = MAX_PUBLISH_LIMIT;
    }

    const visibility = await getEventVisibilityFilter(this.userId);
    return EventsCollection.find(withEventVisibility(filter, visibility), limitedOptions);
  });

  Meteor.methods({
    'events.rsvp': async function (eventId: string): Promise<boolean> {
      validateUserId(this.userId);
      validateString(eventId);

      const event = await findVisibleEvent(this.userId as string, eventId);

      const attendees = event.attendees || [];
      const isSignedUp = attendees.includes(this.userId);

      if (isSignedUp) {
        await EventsCollection.updateAsync(eventId, { $pull: { attendees: this.userId } } as never);
        await createLog('events.rsvp.removed', { eventId, userId: this.userId });
      } else {
        await EventsCollection.updateAsync(eventId, { $addToSet: { attendees: this.userId } } as never);
        await createLog('events.rsvp.added', { eventId, userId: this.userId });
      }

      return !isSignedUp;
    },
    'events.detail': async function (eventId: string) {
      validateUserId(this.userId);
      validateString(eventId);

      const event = await findVisibleEvent(this.userId as string, eventId);

      // Event-type lookup, host names, and attendee names are independent —
      // race them via Promise.all instead of waterfalling.
      const [eventType, hosts, attendees] = await Promise.all([
        event.eventType ? EventTypesCollection.findOneAsync(event.eventType) : Promise.resolve(null),
        resolveNames(event.hosts),
        resolveNames(event.attendees),
      ]);

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
