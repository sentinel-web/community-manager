import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import { loadMemberPoints, type PointsMember } from '../../server/attendance-points';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

// Member ids become dynamic Mongo field paths inside loadMemberPoints, and
// `members.profileStats` accepts a caller-supplied member object, so the loader
// is reachable with ids that are not usable strings. It must degrade to zeroed
// totals instead of throwing a raw TypeError (which reaches the client as a 500
// with a stack trace).

const ZERO = { attendancePoints: 0, inactivityPoints: 0 };

describe('loadMemberPoints — non-string / unqueryable member ids', () => {
  it('returns zeroed totals instead of throwing when the _id is missing or not a string', async () => {
    const points = await loadMemberPoints([{}, { _id: 123 }, { _id: '' }] as unknown as PointsMember[]);
    assert.deepStrictEqual(Object.values(points), [ZERO, ZERO, ZERO]);
  });

  it('skips the attendance query for ids holding Mongo path/operator characters but keeps their static points', async () => {
    const points = await loadMemberPoints([
      { _id: 'a.b', profile: { staticAttendancePoints: 3, staticInactivityPoints: 1 } },
      { _id: '$ne', profile: { staticAttendancePoints: 2 } },
    ]);
    assert.deepStrictEqual(points['a.b'], { attendancePoints: 3, inactivityPoints: 1 });
    assert.deepStrictEqual(points.$ne, { attendancePoints: 2, inactivityPoints: 0 });
  });
});

describe('members.profileStats / attendances.pointsSummary — hostile arguments', () => {
  let adminUserId: string;
  let memberUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    [adminUserId, memberUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ profile: { staticAttendancePoints: 4, staticInactivityPoints: 1 } }),
    ]);
    const eventId = await createTestDoc(EventsCollection, { name: 'Hostile-id op' });
    await createTestDoc(AttendancesCollection, { eventId, [memberUserId]: 1 });
  });

  after(async () => {
    await cleanupFixtures([AttendancesCollection, EventsCollection]);
  });

  it('rejects a member object with no _id', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'members.profileStats', {}), 'validateRequiredString');
  });

  it('rejects a member object whose _id is not a string', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'members.profileStats', { _id: 123 }), 'validateRequiredString');
  });

  it('rejects a member object whose _id is a Mongo operator', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'members.profileStats', { _id: { $ne: null } }), 'validateRequiredString');
  });

  it('still resolves a full member document (the dashboard.stats path)', async () => {
    const user = await Meteor.users.findOneAsync(memberUserId);
    const stats = (await callAs(adminUserId, 'members.profileStats', user)) as Record<string, unknown>;
    assert.strictEqual(stats['attendance points'], 5);
    assert.strictEqual(stats['inactivity points'], 1);
  });

  it('ignores member ids holding Mongo path/operator characters', async () => {
    const summary = await callAs(adminUserId, 'attendances.pointsSummary', ['a.b', '$ne']);
    assert.deepStrictEqual(summary, {});
  });
});
