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

// The generated `events.read`/`events.count`/`events.options` methods and the
// command palette read events without going through the `events` publication,
// so they need the same visibility filter — otherwise any caller with
// `events.read` can enumerate private events (or see their names in the palette
// and get a 404 on click).

interface OptionRow {
  value: string;
}

describe('generic events reads + palette.search — private event visibility', () => {
  let adminUserId: string;
  let memberUserId: string;
  let hostUserId: string;
  let publicEventId: string;
  let privateEventId: string;

  before(async () => {
    const [adminRoleId, memberRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ events: { read: true, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, memberUserId, hostUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: memberRoleId }),
      createTestUser({ roleId: memberRoleId }),
    ]);
    const start = new Date();
    [publicEventId, privateEventId] = await Promise.all([
      createTestDoc(EventsCollection, { name: 'Visibility public op', start, end: start, attendees: [] }),
      createTestDoc(EventsCollection, { name: 'Visibility private op', start, end: start, isPrivate: true, hosts: [hostUserId], attendees: [] }),
    ]);
  });

  after(async () => {
    await cleanupFixtures([EventsCollection]);
  });

  it('omits private events from events.read for a member who neither hosts nor attends', async () => {
    const events = (await callAs(memberUserId, 'events.read', {})) as { _id: string }[];
    const ids = events.map(event => event._id);
    assert.ok(ids.includes(publicEventId), 'public event should be readable');
    assert.ok(!ids.includes(privateEventId), 'private event must not be readable');
  });

  it('returns nothing when events.read is given a known private event id', async () => {
    const events = (await callAs(memberUserId, 'events.read', { _id: privateEventId })) as { _id: string }[];
    assert.deepStrictEqual(events, []);
  });

  it('still returns private events to their host and to admins via events.read', async () => {
    for (const userId of [hostUserId, adminUserId]) {
      const events = (await callAs(userId, 'events.read', { _id: privateEventId })) as { _id: string }[];
      assert.deepStrictEqual(
        events.map(event => event._id),
        [privateEventId]
      );
    }
  });

  it('excludes private events from events.count', async () => {
    const hidden = await callAs(memberUserId, 'events.count', { _id: privateEventId });
    assert.strictEqual(hidden, 0);
    const visible = await callAs(hostUserId, 'events.count', { _id: privateEventId });
    assert.strictEqual(visible, 1);
  });

  it('excludes private events from events.options', async () => {
    const options = (await callAs(memberUserId, 'events.options', {})) as OptionRow[];
    const values = options.map(option => option.value);
    assert.ok(values.includes(publicEventId));
    assert.ok(!values.includes(privateEventId));
  });

  it('omits private events from palette.search for a member who cannot see them', async () => {
    const result = (await callAs(memberUserId, 'palette.search', 'Visibility')) as { events: { _id: string }[] };
    const ids = result.events.map(event => event._id);
    assert.ok(ids.includes(publicEventId));
    assert.ok(!ids.includes(privateEventId));
  });

  it('still lists private events in palette.search for their host', async () => {
    const result = (await callAs(hostUserId, 'palette.search', 'Visibility private')) as { events: { _id: string }[] };
    assert.deepStrictEqual(
      result.events.map(event => event._id),
      [privateEventId]
    );
  });
});
