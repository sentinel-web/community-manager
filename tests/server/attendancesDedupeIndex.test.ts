import assert from 'node:assert';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import { TEST_PREFIX } from './fixtures';
import type { ensureAttendancesUniqueIndex as ensureType } from '../../server/main';

// Use require() instead of import to avoid the circular dependency between
// server/main.ts and crud.lib.ts during module initialization. By the time
// tests run, all modules are fully initialized. The type-only import above
// keeps the call site fully typed.
function loadEnsureAttendancesUniqueIndex(): typeof ensureType {
  return require('../../server/main').ensureAttendancesUniqueIndex;
}

// Guards the startup-safe, idempotent index setup for #270. PR #261 promoted
// the { eventId } index to unique to close the attendances.upsert race, but on
// an EXISTING deployment that crashed startup two ways: an IndexOptionsConflict
// against a pre-existing non-unique index, and a duplicate-key build error when
// duplicate per-event docs already existed. ensureAttendancesUniqueIndex first
// merges duplicate per-event docs (one doc per event, member statuses under
// dynamic [memberId] keys), drops any conflicting non-unique index, then builds
// the unique index — without crashing.
describe('ensureAttendancesUniqueIndex — startup-safe dedupe + unique index (#270)', () => {
  const ensureAttendancesUniqueIndex = loadEnsureAttendancesUniqueIndex();
  const eventId = `${TEST_PREFIX}event_270`;
  // Mongo-shaped member ids (the dynamic status keys on the per-event doc).
  const memberA = 'aaaaaaaaaaaaaaaaa';
  const memberB = 'bbbbbbbbbbbbbbbbb';

  async function dropEventIdIndex(): Promise<void> {
    const raw = AttendancesCollection.rawCollection();
    // indexes() throws "ns does not exist" if the collection has never been
    // materialized (no docs inserted yet) — treat that as "no index to drop".
    let existing: Array<{ name?: string; key?: Record<string, number> }>;
    try {
      existing = (await raw.indexes()) as Array<{ name?: string; key?: Record<string, number> }>;
    } catch {
      return;
    }
    const idx = existing.find(i => i.key && i.key.eventId === 1 && Object.keys(i.key).length === 1);
    if (idx?.name) await raw.dropIndex(idx.name);
  }

  beforeEach(async () => {
    await AttendancesCollection.removeAsync({ eventId });
    await dropEventIdIndex();
  });

  after(async () => {
    await AttendancesCollection.removeAsync({ eventId });
  });

  it('merges duplicate per-event docs into one and builds the unique index without throwing', async () => {
    // Seed two docs for the same eventId with different member-status keys —
    // exactly the pre-existing state that would block a naive unique-index build.
    await AttendancesCollection.insertAsync({ eventId, [memberA]: 1 } as never);
    await AttendancesCollection.insertAsync({ eventId, [memberB]: 2 } as never);

    const before = await AttendancesCollection.find({ eventId }).fetchAsync();
    assert.strictEqual(before.length, 2, 'fixture should start with two duplicate per-event docs');

    // Must not throw even though duplicates exist at call time.
    await assert.doesNotReject(() => ensureAttendancesUniqueIndex());

    // Exactly one doc remains, carrying both members' merged status keys.
    const after = await AttendancesCollection.find({ eventId }).fetchAsync();
    assert.strictEqual(after.length, 1, 'expected exactly one merged attendance doc');
    assert.strictEqual(after[0][memberA], 1, 'memberA status should survive the merge');
    assert.strictEqual(after[0][memberB], 2, 'memberB status should survive the merge');

    // The unique { eventId } index now exists.
    const indexes = (await AttendancesCollection.rawCollection().indexes()) as Array<{
      key?: Record<string, number>;
      unique?: boolean;
    }>;
    const uniqueIdx = indexes.find(i => i.key && i.key.eventId === 1 && Object.keys(i.key).length === 1 && i.unique === true);
    assert.ok(uniqueIdx, 'expected a unique { eventId } index after setup');

    // The unique constraint is actually enforced post-setup.
    await assert.rejects(() => AttendancesCollection.insertAsync({ eventId, [memberA]: 1 } as never));
  });

  it('resolves a pre-existing non-unique { eventId } index without IndexOptionsConflict', async () => {
    // Simulate a legacy deployment: a non-unique { eventId } index already there.
    await AttendancesCollection.rawCollection().createIndex({ eventId: 1 });
    await AttendancesCollection.insertAsync({ eventId, [memberA]: 1 } as never);

    await assert.doesNotReject(() => ensureAttendancesUniqueIndex());

    const indexes = (await AttendancesCollection.rawCollection().indexes()) as Array<{
      key?: Record<string, number>;
      unique?: boolean;
    }>;
    const uniqueIdx = indexes.find(i => i.key && i.key.eventId === 1 && Object.keys(i.key).length === 1 && i.unique === true);
    assert.ok(uniqueIdx, 'expected the non-unique index to be replaced by a unique one');
  });

  it('is idempotent — a second run on already-clean data is a no-op that still throws nothing', async () => {
    await AttendancesCollection.insertAsync({ eventId, [memberA]: 1 } as never);
    await ensureAttendancesUniqueIndex();
    await assert.doesNotReject(() => ensureAttendancesUniqueIndex());

    const after = await AttendancesCollection.find({ eventId }).fetchAsync();
    assert.strictEqual(after.length, 1, 'second run should leave the single doc untouched');
  });

  // On a fresh database the collection does not exist yet, so indexes() fails
  // with NamespaceNotFound (code 26). That is expected on every first start and
  // must stay silent; any other inspect failure is still logged.
  describe('inspect failures', () => {
    // rawCollection() hands out a fresh driver Collection per call, so the stub
    // must go on the shared prototype to reach the instance the code under test gets.
    const proto = Object.getPrototypeOf(AttendancesCollection.rawCollection()) as ReturnType<typeof AttendancesCollection.rawCollection>;
    const originalIndexes = proto.indexes;
    const originalWarn = console.warn;
    let warnings: unknown[][];

    function failIndexesWith(code: number): void {
      proto.indexes = (() => Promise.reject(Object.assign(new Error('stubbed indexes() failure'), { code }))) as typeof proto.indexes;
    }

    beforeEach(() => {
      warnings = [];
      console.warn = (...args: unknown[]) => warnings.push(args);
    });

    afterEach(() => {
      proto.indexes = originalIndexes;
      console.warn = originalWarn;
    });

    it('stays silent on NamespaceNotFound (fresh database)', async () => {
      failIndexesWith(26);
      await assert.doesNotReject(() => ensureAttendancesUniqueIndex());
      assert.strictEqual(warnings.length, 0, 'NamespaceNotFound should not be logged');
    });

    it('still warns on any other inspect failure', async () => {
      failIndexesWith(13);
      await assert.doesNotReject(() => ensureAttendancesUniqueIndex());
      assert.strictEqual(warnings.length, 1, 'other failures should be logged once');
    });
  });
});
