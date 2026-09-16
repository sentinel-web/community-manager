import assert from 'node:assert';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';
import type { MemberPoints } from '../../imports/api/attendance/points';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

// attendances.pointsSummary returns each member's TRUE point totals across all
// attendances, so the grid no longer shows totals limited to the loaded events
// (#363), and it honours event types excluded from inactivity (#366).

type Summary = Record<string, MemberPoints>;

describe('attendances.pointsSummary (#363, #366)', () => {
  let adminUserId: string;
  let noEventsReadUserId: string;
  let squadViewerId: string;
  let memberId: string;
  let otherSquadMemberId: string;
  let edgeTypeMemberId: string;
  let noAttendanceMemberId: string;

  before(async () => {
    const [adminRoleId, noEventsRoleId, eventsReadRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ events: { read: false, create: false, update: false, delete: false } }),
      createTestRole({ events: { read: true, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, noEventsReadUserId, squadViewerId, memberId, otherSquadMemberId, edgeTypeMemberId, noAttendanceMemberId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: noEventsRoleId }),
      createTestUser({ roleId: eventsReadRoleId, profile: { squadId: 'test_squad_a' } }),
      createTestUser({ profile: { squadId: 'test_squad_a', staticAttendancePoints: 5, staticInactivityPoints: 2 } }),
      createTestUser({ profile: { squadId: 'test_squad_b' } }),
      createTestUser({ profile: { squadId: 'test_squad_a' } }),
      createTestUser({ profile: { squadId: 'test_squad_a', staticAttendancePoints: 3, staticInactivityPoints: 1 } }),
    ]);

    const [countingTypeId, excludedTypeId] = await Promise.all([
      createTestDoc(EventTypesCollection, { name: 'Operation' }),
      createTestDoc(EventTypesCollection, { name: 'Social', countsForInactivity: false }),
    ]);
    const [opA, opB, opC, social, cancelled] = await Promise.all([
      createTestDoc(EventsCollection, { name: 'Op A', eventType: countingTypeId }),
      createTestDoc(EventsCollection, { name: 'Op B', eventType: countingTypeId }),
      createTestDoc(EventsCollection, { name: 'Op C' }),
      createTestDoc(EventsCollection, { name: 'Social', eventType: excludedTypeId }),
      createTestDoc(EventsCollection, { name: 'Cancelled', eventType: countingTypeId }),
    ]);
    // `countsForInactivity` is unset = true, so a no-show only escapes an
    // inactivity point when its event type explicitly opts out. An event with no
    // event type at all, or one whose event type has since been deleted, must
    // still cost an inactivity point.
    const danglingTypeId = await createTestDoc(EventTypesCollection, { name: 'Deleted type', countsForInactivity: false });
    const [typelessOp, danglingTypeOp] = await Promise.all([
      createTestDoc(EventsCollection, { name: 'Typeless op' }),
      createTestDoc(EventsCollection, { name: 'Dangling type op', eventType: danglingTypeId }),
    ]);
    await EventTypesCollection.removeAsync({ _id: danglingTypeId });

    await Promise.all([
      createTestDoc(AttendancesCollection, { eventId: opA, [memberId]: 1, [otherSquadMemberId]: -1 }),
      createTestDoc(AttendancesCollection, { eventId: opB, [memberId]: -1 }),
      createTestDoc(AttendancesCollection, { eventId: opC, [memberId]: 2 }),
      createTestDoc(AttendancesCollection, { eventId: social, [memberId]: -1 }),
      createTestDoc(AttendancesCollection, { eventId: cancelled, [memberId]: -2 }),
      createTestDoc(AttendancesCollection, { eventId: typelessOp, [edgeTypeMemberId]: -1 }),
      createTestDoc(AttendancesCollection, { eventId: danglingTypeOp, [edgeTypeMemberId]: -1 }),
    ]);
  });

  after(async () => {
    await cleanupFixtures([AttendancesCollection, EventsCollection, EventTypesCollection]);
  });

  it('rejects unauthenticated calls with 401', async () => {
    await assertRejectsWithCode(() => callAs(null, 'attendances.pointsSummary', [memberId]), 401);
  });

  it('rejects callers without events.read permission with 403', async () => {
    await assertRejectsWithCode(() => callAs(noEventsReadUserId, 'attendances.pointsSummary', [memberId]), 403);
  });

  it('answers an unauthorized caller with 403 even when the argument is also invalid', async () => {
    const tooMany = Array.from({ length: 1001 }, (_, i) => `test_member_${i}`);
    await assertRejectsWithCode(() => callAs(noEventsReadUserId, 'attendances.pointsSummary', tooMany), 403);
  });

  it('rejects a non-array argument', async () => {
    await assert.rejects(() => callAs(adminUserId, 'attendances.pointsSummary', memberId));
  });

  it('rejects more member ids than the grid can load with 400', async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `test_member_${i}`);
    await assertRejectsWithCode(() => callAs(adminUserId, 'attendances.pointsSummary', ids), 400);
  });

  it('returns totals across all attendances, with static points, ignoring no-shows at excluded event types', async () => {
    const summary = (await callAs(adminUserId, 'attendances.pointsSummary', [memberId, otherSquadMemberId])) as Summary;
    // static 5 + present 1 + zeus 1 - no-show at Op B 1 - no-show at Social 1 = 5
    // static 2 + no-show at Op B 1 (the Social no-show is excluded) = 3
    assert.deepStrictEqual(summary[memberId], { attendancePoints: 5, inactivityPoints: 3 });
    assert.deepStrictEqual(summary[otherSquadMemberId], { attendancePoints: -1, inactivityPoints: 1 });
  });

  it('still charges an inactivity point for a no-show at an event with no event type or a deleted one', async () => {
    const summary = (await callAs(adminUserId, 'attendances.pointsSummary', [edgeTypeMemberId])) as Summary;
    assert.deepStrictEqual(summary[edgeTypeMemberId], { attendancePoints: -2, inactivityPoints: 2 });
  });

  it('returns the static points of an in-scope member with no attendance documents', async () => {
    const summary = (await callAs(adminUserId, 'attendances.pointsSummary', [noAttendanceMemberId])) as Summary;
    assert.deepStrictEqual(summary[noAttendanceMemberId], { attendancePoints: 3, inactivityPoints: 1 });
  });

  it('omits unknown member ids', async () => {
    const summary = (await callAs(adminUserId, 'attendances.pointsSummary', ['test_does_not_exist'])) as Summary;
    assert.deepStrictEqual(summary, {});
  });

  it('limits non-officers to members of their own squad', async () => {
    const summary = (await callAs(squadViewerId, 'attendances.pointsSummary', [memberId, otherSquadMemberId])) as Summary;
    assert.deepStrictEqual(Object.keys(summary), [memberId]);
  });

  it('agrees with the profile statistics for the same member', async () => {
    const [summary, profile] = (await Promise.all([
      callAs(adminUserId, 'attendances.pointsSummary', [memberId]),
      callAs(adminUserId, 'members.profileStats', memberId),
    ])) as [Summary, Record<string, unknown>];
    assert.strictEqual(profile['attendance points'], summary[memberId].attendancePoints);
    assert.strictEqual(profile['inactivity points'], summary[memberId].inactivityPoints);
  });
});
