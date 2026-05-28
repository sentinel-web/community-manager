import assert from 'node:assert';
import { Random } from 'meteor/random';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import { collectForeignKeyValues, resolveOrphans, validateForeignKeysForUpdate } from '../../server/integrity';
import {
  assertRejectsWithCode,
  callAs,
  cleanupFixtures,
  createTestDoc,
  createTestRole,
  createTestUser,
  TEST_PREFIX,
} from './fixtures';

// ────────────────────────────────────────────────────────────
// Decision O-6: FULL-DOCUMENT foreign-key enforcement on every write.
//
// Stricter than the touched-fields-only path it replaces (RULE-027): on
// BOTH insert and update, every FK field declared in the registry must
// resolve to an existing target on the RESULTING document — not only the
// fields a given write touches. The pre-O-6 tolerance cases (editing an
// unrelated field on a doc that already carries an orphaned FK) now reject.
//
// The orphan migration (integrity.scanResolve / scripts/integrity-scan.ts)
// must be run before this is enabled in production so legacy orphans don't
// start blocking unrelated edits.
// ────────────────────────────────────────────────────────────

describe('integrity O-6 — collectForeignKeyValues (full-doc FK extraction unit)', () => {
  it('returns no entries for a collection without foreign keys', () => {
    assert.deepStrictEqual(collectForeignKeyValues('medals', { name: 'x' }), []);
  });

  it('collects every FK field present on a full document', () => {
    const collected = collectForeignKeyValues('specializations', {
      name: 'Engineer',
      requiredRankId: 'rank-1',
      requiredSpecializations: ['spec-a', 'spec-b'],
      instructors: ['m1'],
    });
    const values = collected.map(c => c.value).sort();
    assert.deepStrictEqual(values, ['m1', 'rank-1', 'spec-a', 'spec-b']);
  });

  it('reads dotted-path FK fields (members.profile.rankId)', () => {
    const collected = collectForeignKeyValues('members', {
      profile: { name: 'X', rankId: 'rank-9', roleId: 'role-3' },
    });
    const byField = Object.fromEntries(collected.map(c => [c.edge.field, c.value]));
    assert.strictEqual(byField['profile.rankId'], 'rank-9');
    assert.strictEqual(byField['profile.roleId'], 'role-3');
  });

  it('skips null / absent FK fields (a cleared FK is valid)', () => {
    const collected = collectForeignKeyValues('specializations', {
      name: 'x',
      requiredRankId: null,
    });
    assert.deepStrictEqual(collected, []);
  });
});

describe('integrity O-6 — validateForeignKeysForUpdate merges modifier onto stored doc', () => {
  let validRankId: string;

  before(async () => {
    validRankId = await createTestDoc(RanksCollection, { name: '__o6_unit_rank', color: '#fff' });
  });

  after(async () => {
    await cleanupFixtures([RanksCollection]);
  });

  it('rejects when an untouched stored FK is an orphan, even if the write touches only a clean field', async () => {
    const stored = { _id: 's1', name: 'old', requiredRankId: 'orphan-rank' };
    await assertRejectsWithCode(
      () => validateForeignKeysForUpdate('specializations', stored, { $set: { name: 'new' } }),
      'foreign_key_invalid',
    );
  });

  it('passes when the write repairs the orphaned FK to a valid target', async () => {
    const stored = { _id: 's1', name: 'old', requiredRankId: 'orphan-rank' };
    // $set repoints requiredRankId at a real rank — merged doc is clean.
    await validateForeignKeysForUpdate('specializations', stored, { $set: { requiredRankId: validRankId } });
  });

  it('passes when the merged document has no foreign keys at all', async () => {
    const stored = { _id: 's1', name: 'old' };
    await validateForeignKeysForUpdate('specializations', stored, { $set: { name: 'new' } });
  });

  it('is a no-op when the stored doc is undefined (concurrently removed)', async () => {
    await validateForeignKeysForUpdate('specializations', undefined, { $set: { requiredRankId: 'whatever' } });
  });
});

describe('integrity O-6 — full-doc enforcement on the live CRUD update path', () => {
  let adminUserId: string;
  let validRankId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
    validRankId = await createTestDoc(RanksCollection, { name: '__o6_rank', color: '#fff' });
  });

  after(async () => {
    await cleanupFixtures([RanksCollection, SpecializationsCollection]);
  });

  it('editing an unrelated field on a doc with a pre-existing orphan FK is REJECTED (inverts RULE-027)', async () => {
    const specId = await createTestDoc(SpecializationsCollection, {
      name: '__o6_orphan_holder',
      requiredRankId: 'rank-that-was-deleted',
    });

    await assertRejectsWithCode(
      () => callAs(adminUserId, 'specializations.update', specId, { name: '__o6_orphan_renamed' }),
      'foreign_key_invalid',
    );

    const doc = await SpecializationsCollection.findOneAsync(specId);
    assert.strictEqual(doc?.name, '__o6_orphan_holder', 'rejected update must not persist');
  });

  it('the SAME edit succeeds once the orphaned FK is repaired in the same write', async () => {
    const specId = await createTestDoc(SpecializationsCollection, {
      name: '__o6_repair_holder',
      requiredRankId: 'rank-that-was-deleted',
    });

    // A write that simultaneously fixes the orphan and renames passes, because
    // full-doc validation runs against the merged (repaired) result.
    await callAs(adminUserId, 'specializations.update', specId, {
      name: '__o6_repaired',
      requiredRankId: validRankId,
    });

    const doc = await SpecializationsCollection.findOneAsync(specId);
    assert.strictEqual(doc?.name, '__o6_repaired');
    assert.strictEqual(doc?.requiredRankId, validRankId);
  });

  it('a clean doc still accepts unrelated-field edits (no false positives)', async () => {
    const specId = await createTestDoc(SpecializationsCollection, {
      name: '__o6_clean',
      requiredRankId: validRankId,
    });
    await callAs(adminUserId, 'specializations.update', specId, { name: '__o6_clean_renamed' });
    const doc = await SpecializationsCollection.findOneAsync(specId);
    assert.strictEqual(doc?.name, '__o6_clean_renamed');
  });
});

describe('integrity O-6 — full-doc enforcement on the members.update custom path', () => {
  let adminUserId: string;
  let validRankId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
    validRankId = await createTestDoc(RanksCollection, { name: '__o6_m_rank', color: '#fff' });
  });

  after(async () => {
    await cleanupFixtures([RanksCollection]);
  });

  it('editing an unrelated profile field on a member with a stale rankId is REJECTED', async () => {
    const memberId = `${TEST_PREFIX}${Random.id()}`;
    await MembersCollection.insertAsync({
      _id: memberId,
      username: memberId,
      profile: { name: 'O6StaleHolder', rankId: 'orphan-rank-from-past' },
    });

    await assertRejectsWithCode(
      () => callAs(adminUserId, 'members.update', memberId, { 'profile.description': 'desc' }),
      'foreign_key_invalid',
    );

    const m = await MembersCollection.findOneAsync(memberId);
    assert.strictEqual(m?.profile?.description, undefined, 'rejected update wrote nothing');
  });

  it('the same member edit succeeds when the rankId is repaired in the same write', async () => {
    const memberId = `${TEST_PREFIX}${Random.id()}`;
    await MembersCollection.insertAsync({
      _id: memberId,
      username: memberId,
      profile: { name: 'O6RepairHolder', rankId: 'orphan-rank-from-past' },
    });

    await callAs(adminUserId, 'members.update', memberId, {
      'profile.description': 'desc',
      'profile.rankId': validRankId,
    });

    const m = await MembersCollection.findOneAsync(memberId);
    assert.strictEqual(m?.profile?.description, 'desc');
    assert.strictEqual(m?.profile?.rankId, validRankId);
  });
});

describe('integrity O-6 — orphan migration (resolveOrphans + integrity.scanResolve)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([MedalsCollection, PositionsCollection]);
  });

  it('dry run reports counts without mutating, then a real run clears the orphans', async () => {
    // setNull orphan: a member whose positionId points at a deleted position.
    const setNullMemberId = `${TEST_PREFIX}${Random.id()}`;
    await MembersCollection.insertAsync({
      _id: setNullMemberId,
      username: setNullMemberId,
      profile: { name: 'OrphanPosHolder', positionId: 'deleted-position' },
    });
    // pull orphan: a member whose medalIds array carries a deleted medal.
    const pullMemberId = `${TEST_PREFIX}${Random.id()}`;
    await MembersCollection.insertAsync({
      _id: pullMemberId,
      username: pullMemberId,
      profile: { name: 'OrphanMedalHolder', medalIds: ['deleted-medal', 'also-deleted'] },
    });

    // Dry run mutates nothing.
    const dry = await resolveOrphans({ dryRun: true });
    assert.ok(dry.pulled >= 2, 'dry run counts the two pull orphans');
    assert.ok(dry.setNull >= 1, 'dry run counts the setNull orphan');
    const stillBroken = await MembersCollection.findOneAsync(setNullMemberId);
    assert.strictEqual(stillBroken?.profile?.positionId, 'deleted-position', 'dry run did not mutate');

    // Real run clears them.
    await resolveOrphans({ dryRun: false });
    const fixedSetNull = await MembersCollection.findOneAsync(setNullMemberId);
    assert.strictEqual(fixedSetNull?.profile?.positionId, null, 'orphaned scalar FK nulled');
    const fixedPull = await MembersCollection.findOneAsync(pullMemberId);
    assert.deepStrictEqual(fixedPull?.profile?.medalIds, [], 'orphaned array FK elements pulled');
  });

  it('block/cascade orphans are reported as skipped, never auto-mutated', async () => {
    // A member referencing a deleted role (block edge) — must be skipped.
    const blockMemberId = `${TEST_PREFIX}${Random.id()}`;
    await MembersCollection.insertAsync({
      _id: blockMemberId,
      username: blockMemberId,
      profile: { name: 'OrphanRoleHolder', roleId: 'deleted-role' },
    });

    const result = await resolveOrphans({ dryRun: false });
    const skippedThis = result.skipped.find(o => o.sourceId === blockMemberId);
    assert.ok(skippedThis, 'block-edge orphan must appear in skipped');
    assert.strictEqual(skippedThis.field, 'profile.roleId');

    const still = await MembersCollection.findOneAsync(blockMemberId);
    assert.strictEqual(still?.profile?.roleId, 'deleted-role', 'block orphan left untouched');
  });

  it('integrity.scanResolve requires admin and accepts a dryRun flag', async () => {
    const result = (await callAs(adminUserId, 'integrity.scanResolve', true)) as {
      pulled: number;
      setNull: number;
      skipped: unknown[];
    };
    assert.ok(typeof result.pulled === 'number');
    assert.ok(Array.isArray(result.skipped));
  });

  it('integrity.scanResolve rejects unauthenticated and non-admin callers', async () => {
    await assertRejectsWithCode(() => callAs(null, 'integrity.scanResolve', true), 401);
    const nonAdminRoleId = await createTestRole({ members: { read: true, create: false, update: false, delete: false } });
    const nonAdminUserId = await createTestUser({ roleId: nonAdminRoleId });
    await assertRejectsWithCode(() => callAs(nonAdminUserId, 'integrity.scanResolve', true), 403);
  });
});
