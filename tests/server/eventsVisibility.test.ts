import assert from 'node:assert';
import EventsCollection from '../../imports/api/collections/events.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

// events.detail and events.rsvp take an event id directly, so they must apply
// the same private-event visibility as the `events` publication: admins see
// every event, everyone else only public events or private events they host or
// attend. An invisible event is reported as 404 so its existence isn't revealed.

interface EventDetailResult {
  _id: string;
  resolvedAttendees: { _id: string; name: string }[];
}

describe('events.detail / events.rsvp — private event visibility', () => {
  let adminUserId: string;
  let memberUserId: string;
  let hostUserId: string;
  let attendeeUserId: string;
  let publicEventId: string;
  let privateEventId: string;

  before(async () => {
    const [adminRoleId, memberRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ events: { read: true, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, memberUserId, hostUserId, attendeeUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: memberRoleId }),
      createTestUser({ roleId: memberRoleId }),
      createTestUser({ roleId: memberRoleId }),
    ]);
  });

  beforeEach(async () => {
    await EventsCollection.removeAsync({ _id: { $in: [publicEventId, privateEventId].filter(Boolean) } });
    const start = new Date();
    [publicEventId, privateEventId] = await Promise.all([
      createTestDoc(EventsCollection, { name: 'Public op', start, end: start, attendees: [] }),
      createTestDoc(EventsCollection, { name: 'Private op', start, end: start, isPrivate: true, hosts: [hostUserId], attendees: [attendeeUserId] }),
    ]);
  });

  after(async () => {
    await cleanupFixtures([EventsCollection]);
  });

  it('returns public events to any logged-in member', async () => {
    const detail = (await callAs(memberUserId, 'events.detail', publicEventId)) as EventDetailResult;
    assert.strictEqual(detail._id, publicEventId);
  });

  it('hides private events from members who neither host nor attend (404)', async () => {
    await assertRejectsWithCode(() => callAs(memberUserId, 'events.detail', privateEventId), 404);
  });

  it('returns private events to their hosts, attendees and admins', async () => {
    for (const userId of [hostUserId, attendeeUserId, adminUserId]) {
      const detail = (await callAs(userId, 'events.detail', privateEventId)) as EventDetailResult;
      assert.strictEqual(detail._id, privateEventId);
    }
  });

  it('refuses RSVP to a private event the caller cannot see (404) and leaves attendees unchanged', async () => {
    await assertRejectsWithCode(() => callAs(memberUserId, 'events.rsvp', privateEventId), 404);
    const event = await EventsCollection.findOneAsync(privateEventId);
    assert.deepStrictEqual(event?.attendees, [attendeeUserId]);
  });

  it('still allows RSVP to public events', async () => {
    const signedUp = await callAs(memberUserId, 'events.rsvp', publicEventId);
    assert.strictEqual(signedUp, true);
  });

  it('lets an attendee of a private event sign off', async () => {
    const signedUp = await callAs(attendeeUserId, 'events.rsvp', privateEventId);
    assert.strictEqual(signedUp, false);
  });
});
