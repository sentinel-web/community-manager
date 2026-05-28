import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestRole, createTestUser, TEST_PREFIX } from './fixtures';

// Guards the fix for #261: attendance recording used a read-then-write
// (find the per-event row, then insert-or-update) whose TOCTOU window let
// concurrent writers each insert a fresh per-event document. The grid stores
// exactly ONE document per event, with each member's status under a dynamic
// [memberId] key — so the correct uniqueness constraint is on { eventId }.
// The fix is an atomic `attendances.upsert` keyed on eventId plus a unique
// { eventId } index. These tests assert duplicates can no longer arise.

describe('attendances.upsert — atomic write, no duplicate per-event rows (#261)', () => {
  let adminUserId: string;
  let unauthorizedUserId: string;
  const eventId = `${TEST_PREFIX}event_261`;
  const memberA = `${TEST_PREFIX}member_a`;
  const memberB = `${TEST_PREFIX}member_b`;

  before(async () => {
    const [adminRoleId, noPermRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ events: { read: true, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, unauthorizedUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: noPermRoleId }),
    ]);
    // Mirror the production unique index (server/main.ts) so the concurrency
    // assertion holds in the test DB regardless of startup ordering. createIndex
    // is idempotent — Mongo dedupes if it already exists.
    await AttendancesCollection.rawCollection().createIndex({ eventId: 1 }, { unique: true });
  });

  beforeEach(async () => {
    await AttendancesCollection.removeAsync({ eventId });
  });

  after(async () => {
    await AttendancesCollection.removeAsync({ eventId });
    await cleanupFixtures();
  });

  it('rejects unauthenticated calls with 401', async () => {
    await assertRejectsWithCode(() => callAs(null, 'attendances.upsert', eventId, memberA, 1), 401);
  });

  it('rejects callers without events.update permission with 403', async () => {
    await assertRejectsWithCode(() => callAs(unauthorizedUserId, 'attendances.upsert', eventId, memberA, 1), 403);
  });

  it('rejects an out-of-range attendance status with 400', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'attendances.upsert', eventId, memberA, 7), 400);
  });

  it('first write creates exactly one per-event row', async () => {
    await callAs(adminUserId, 'attendances.upsert', eventId, memberA, 1);
    const docs = await AttendancesCollection.find({ eventId }).fetchAsync();
    assert.strictEqual(docs.length, 1, 'Expected exactly one attendance document for the event');
    assert.strictEqual(docs[0][memberA], 1);
  });

  it('concurrent writes for the same event do not create duplicate rows', async () => {
    // Fire both writes without awaiting in between — the old read-then-write
    // would have both observed "no row" and each inserted, producing two docs.
    const results = await Promise.allSettled([
      callAs(adminUserId, 'attendances.upsert', eventId, memberA, 1),
      callAs(adminUserId, 'attendances.upsert', eventId, memberB, 2),
    ]);
    // At least one must succeed; the unique index serializes the writers so no
    // duplicate row survives. (A loser may reject with a duplicate-key error,
    // which is acceptable — the invariant under test is "no duplicate rows".)
    assert.ok(
      results.some(r => r.status === 'fulfilled'),
      'Expected at least one concurrent upsert to succeed'
    );
    const docs = await AttendancesCollection.find({ eventId }).fetchAsync();
    assert.strictEqual(docs.length, 1, 'Expected exactly one attendance document despite concurrent writes');
  });

  it('a second write updates the existing row rather than duplicating it', async () => {
    await callAs(adminUserId, 'attendances.upsert', eventId, memberA, 1);
    await callAs(adminUserId, 'attendances.upsert', eventId, memberA, -1);

    const docs = await AttendancesCollection.find({ eventId }).fetchAsync();
    assert.strictEqual(docs.length, 1, 'Expected the second write to update, not duplicate');
    assert.strictEqual(docs[0][memberA], -1, 'Expected the member status to be updated to the new value');
  });

  it('writes for different members accumulate on the same per-event row', async () => {
    await callAs(adminUserId, 'attendances.upsert', eventId, memberA, 1);
    await callAs(adminUserId, 'attendances.upsert', eventId, memberB, 2);

    const docs = await AttendancesCollection.find({ eventId }).fetchAsync();
    assert.strictEqual(docs.length, 1, 'Expected a single shared per-event document');
    assert.strictEqual(docs[0][memberA], 1);
    assert.strictEqual(docs[0][memberB], 2);
  });

  it('the unique { eventId } index rejects a raw duplicate insert', async () => {
    await AttendancesCollection.insertAsync({ eventId, [memberA]: 1 } as never);
    await assert.rejects(() => AttendancesCollection.insertAsync({ eventId, [memberB]: 2 } as never));
  });
});
