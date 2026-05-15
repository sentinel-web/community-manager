import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import LogsCollection from '../../imports/api/collections/logs.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import {
  assertRejectsWithCode,
  callAs,
  cleanupFixtures,
  createTestDoc,
  createTestRole,
  createTestUser,
  findLatestAuditLog,
  TEST_PREFIX,
} from './fixtures';

// Targets server/integrity.ts and the wiring in server/crud.lib.ts (.remove
// path) plus the integrity.preview Meteor method registered by
// server/apis/integrity.server.ts. Slice #162 covers the `block` primitive
// only — subsequent slices add pull/setNull/cascade and extend these tests.

interface BlockedByEntry {
  source: string;
  count: number;
  sample: string[];
}

interface IntegrityPreview {
  blockedBy: BlockedByEntry[];
  pulled: Record<string, number>;
  setNull: Record<string, number>;
  cascaded: Record<string, number>;
}

describe('integrity layer — block primitive on members.profile.rankId → ranks (#162)', () => {
  let adminUserId: string;
  let officerUserId: string;
  let officerSquadId: string;
  let otherSquadId: string;
  let officerSquadMemberIds: string[] = [];
  let otherSquadMemberIds: string[] = [];

  // Local prefixed-id helper since fixtures only exposes prefixed inserters
  // that need a Collection — squads have only an _id and name.
  function prefixedId(): string {
    return `${TEST_PREFIX}${Random.id()}`;
  }

  before(async () => {
    const [adminRoleId, officerRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({
        ranks: { read: true, create: true, update: true, delete: true },
        members: { read: true, create: false, update: false, delete: false },
      }),
    ]);

    officerSquadId = prefixedId();
    otherSquadId = prefixedId();

    [adminUserId, officerUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: officerRoleId, profile: { squadId: officerSquadId } }),
    ]);
  });

  after(async () => {
    await cleanupFixtures([RanksCollection]);
  });

  it('returns empty preview when no docs reference the target', async () => {
    const rankId = await createTestDoc(RanksCollection, { name: '__test_rank_empty', color: '#fff' });

    const preview = (await callAs(adminUserId, 'integrity.preview', 'ranks', rankId)) as IntegrityPreview;

    assert.deepStrictEqual(preview.blockedBy, []);
    assert.deepStrictEqual(preview.pulled, {});
    assert.deepStrictEqual(preview.setNull, {});
    assert.deepStrictEqual(preview.cascaded, {});
  });

  it('block fires when a member references the rank — admin sees full count + sample of names', async () => {
    const rankId = await createTestDoc(RanksCollection, { name: '__test_rank_blocked', color: '#fff' });
    officerSquadMemberIds = await Promise.all([
      createTestUser({ profile: { name: 'Alpha-1', rankId, squadId: officerSquadId } }),
      createTestUser({ profile: { name: 'Bravo-2', rankId, squadId: officerSquadId } }),
    ]);
    otherSquadMemberIds = await Promise.all([
      createTestUser({ profile: { name: 'Charlie-3', rankId, squadId: otherSquadId } }),
      createTestUser({ profile: { name: 'Delta-4', rankId, squadId: otherSquadId } }),
      createTestUser({ profile: { name: 'Echo-5', rankId, squadId: otherSquadId } }),
    ]);

    const preview = (await callAs(adminUserId, 'integrity.preview', 'ranks', rankId)) as IntegrityPreview;

    assert.strictEqual(preview.blockedBy.length, 1, 'expected one blocking source');
    const entry = preview.blockedBy[0];
    assert.strictEqual(entry.source, 'members');
    assert.strictEqual(entry.count, 5, 'expected full count regardless of squad scope for admin');
    assert.ok(entry.sample.length > 0 && entry.sample.length <= 5, 'sample is bounded');
    assert.ok(
      entry.sample.every(name => /^(Alpha|Bravo|Charlie|Delta|Echo)-\d$/.test(name)),
      `sample contained unexpected names: ${JSON.stringify(entry.sample)}`,
    );

    // Cleanup the members the test inserted so cleanupFixtures (which only
    // wipes via cleanupFixtures + RanksCollection here) doesn't leave tail
    // state that would skew later assertions.
    // Members are already prefixed-id'd, so the global cleanupFixtures
    // pass at the end of the suite catches them.
  });

  it('squad-scoped officer sees full count but sample restricted to their squad', async () => {
    const rankId = await createTestDoc(RanksCollection, { name: '__test_rank_squad_scope', color: '#fff' });
    await createTestUser({ profile: { name: 'Foxtrot-6', rankId, squadId: officerSquadId } });
    await createTestUser({ profile: { name: 'Golf-7', rankId, squadId: officerSquadId } });
    await createTestUser({ profile: { name: 'Hotel-8', rankId, squadId: otherSquadId } });
    await createTestUser({ profile: { name: 'India-9', rankId, squadId: otherSquadId } });

    const preview = (await callAs(officerUserId, 'integrity.preview', 'ranks', rankId)) as IntegrityPreview;

    assert.strictEqual(preview.blockedBy.length, 1);
    const entry = preview.blockedBy[0];
    assert.strictEqual(entry.count, 4, 'count must be the full count, not the squad-scoped count');
    assert.ok(entry.sample.length > 0, 'sample should not be empty for an officer who has at least one in-scope member');
    assert.ok(
      entry.sample.every(name => name === 'Foxtrot-6' || name === 'Golf-7'),
      `officer's sample leaked out-of-squad names: ${JSON.stringify(entry.sample)}`,
    );
  });

  it('attempting to delete a referenced rank throws foreign_key_blocked with structured details', async () => {
    const rankId = await createTestDoc(RanksCollection, { name: '__test_rank_delete_block', color: '#fff' });
    await createTestUser({ profile: { name: 'Juliet-10', rankId, squadId: officerSquadId } });

    let captured: Meteor.Error | null = null;
    try {
      await callAs(adminUserId, 'ranks.remove', rankId);
    } catch (error) {
      captured = error as Meteor.Error;
    }

    assert.ok(captured, 'expected ranks.remove to throw');
    assert.strictEqual(captured.error, 'foreign_key_blocked');
    const details = captured.details as { blockedBy: BlockedByEntry[] };
    assert.ok(details && Array.isArray(details.blockedBy), 'expected details.blockedBy array');
    assert.strictEqual(details.blockedBy.length, 1);
    assert.strictEqual(details.blockedBy[0].source, 'members');
    assert.ok(details.blockedBy[0].count >= 1);

    const stillThere = await RanksCollection.findOneAsync(rankId);
    assert.ok(stillThere, 'rank must remain when delete was blocked');
  });

  it('preview output matches what the execute path would observe (preview/execute equivalence)', async () => {
    const rankId = await createTestDoc(RanksCollection, { name: '__test_rank_equivalence', color: '#fff' });
    await createTestUser({ profile: { name: 'Kilo-11', rankId, squadId: officerSquadId } });
    await createTestUser({ profile: { name: 'Lima-12', rankId, squadId: officerSquadId } });

    const preview = (await callAs(adminUserId, 'integrity.preview', 'ranks', rankId)) as IntegrityPreview;

    let executeError: Meteor.Error | null = null;
    try {
      await callAs(adminUserId, 'ranks.remove', rankId);
    } catch (error) {
      executeError = error as Meteor.Error;
    }

    assert.ok(executeError, 'expected execute to throw because preview said it was blocked');
    const executeDetails = (executeError.details as { blockedBy: BlockedByEntry[] }).blockedBy;
    assert.strictEqual(preview.blockedBy.length, executeDetails.length);
    assert.strictEqual(preview.blockedBy[0].source, executeDetails[0].source);
    assert.strictEqual(preview.blockedBy[0].count, executeDetails[0].count);
  });

  it('rank delete with no references succeeds and produces a log without cascadeEffects', async () => {
    const rankId = await createTestDoc(RanksCollection, { name: '__test_rank_clean_delete', color: '#fff' });

    const result = (await callAs(adminUserId, 'ranks.remove', rankId)) as { id: string };
    assert.strictEqual(result.id, rankId);

    const gone = await RanksCollection.findOneAsync(rankId);
    assert.strictEqual(gone, undefined, 'rank should be deleted');

    const log = await findLatestAuditLog('ranks.deleted', rankId);
    assert.ok(log, 'expected audit log for rank deletion');
    assert.strictEqual(log.payload.id, rankId);
    assert.strictEqual(
      (log.payload as Record<string, unknown>).cascadeEffects,
      undefined,
      'no cascadeEffects expected when no integrity primitives fire',
    );
  });

  it('integrity.preview rejects unknown collection names', async () => {
    await assertRejectsWithCode(
      () => callAs(adminUserId, 'integrity.preview', 'definitely_not_a_collection', 'someId'),
      400,
    );
  });

  it('integrity.preview rejects unauthenticated callers', async () => {
    await assertRejectsWithCode(() => callAs(null, 'integrity.preview', 'ranks', 'someId'), 401);
  });

  it('integrity.preview enforces delete permission on the target collection', async () => {
    const noPermRoleId = await createTestRole({
      ranks: { read: true, create: false, update: false, delete: false },
    });
    const noPermUserId = await createTestUser({ roleId: noPermRoleId });

    const rankId = await createTestDoc(RanksCollection, { name: '__test_rank_perm', color: '#fff' });

    await assertRejectsWithCode(() => callAs(noPermUserId, 'integrity.preview', 'ranks', rankId), 403);
  });

  // Suppress unused-vars warning — we rely on cleanupFixtures to scrub these.
  void officerSquadMemberIds;
  void otherSquadMemberIds;
  void LogsCollection;
});
