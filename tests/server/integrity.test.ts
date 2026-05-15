import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import EventsCollection from '../../imports/api/collections/events.collection';
import LogsCollection from '../../imports/api/collections/logs.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import { enforceIntegrityOnDelete } from '../../server/integrity';
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

describe('integrity layer — pull primitive on array foreign keys (#163)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([
      EventsCollection,
      MedalsCollection,
      SpecializationsCollection,
      TasksCollection,
    ]);
  });

  it('deleting a Medal pulls it from every member.profile.medalIds array', async () => {
    const medalId = await createTestDoc(MedalsCollection, { name: '__test_medal_pull', color: '#fff' });
    const memberIds = await Promise.all([
      createTestUser({ profile: { name: 'PullA', medalIds: [medalId] } }),
      createTestUser({ profile: { name: 'PullB', medalIds: [medalId, 'other-medal-id'] } }),
      createTestUser({ profile: { name: 'PullC', medalIds: ['other-medal-id'] } }),
    ]);

    const result = (await callAs(adminUserId, 'medals.remove', medalId)) as {
      id: string;
      effects: { pulled: Record<string, number> };
    };

    assert.strictEqual(result.id, medalId);
    assert.strictEqual(result.effects.pulled.members, 2, 'expected 2 members to have had the medal pulled');

    const remainingA = await MembersCollection.findOneAsync(memberIds[0]);
    const remainingB = await MembersCollection.findOneAsync(memberIds[1]);
    const remainingC = await MembersCollection.findOneAsync(memberIds[2]);
    assert.deepStrictEqual(remainingA?.profile?.medalIds, []);
    assert.deepStrictEqual(remainingB?.profile?.medalIds, ['other-medal-id']);
    assert.deepStrictEqual(remainingC?.profile?.medalIds, ['other-medal-id']);
  });

  it('audit log records cascadeEffects.pulled when a delete triggers pulls', async () => {
    const medalId = await createTestDoc(MedalsCollection, { name: '__test_medal_audit', color: '#fff' });
    await createTestUser({ profile: { name: 'AuditA', medalIds: [medalId] } });
    await createTestUser({ profile: { name: 'AuditB', medalIds: [medalId] } });

    await callAs(adminUserId, 'medals.remove', medalId);

    const log = await findLatestAuditLog('medals.deleted', medalId);
    assert.ok(log, 'expected audit log for medal delete');
    const cascadeEffects = (log.payload as Record<string, unknown>).cascadeEffects as
      | { pulled: Record<string, number> }
      | undefined;
    assert.ok(cascadeEffects, 'expected cascadeEffects to appear in audit payload');
    assert.strictEqual(cascadeEffects.pulled.members, 2);
  });

  it('preview reports same pulled counts that execute would produce', async () => {
    const medalId = await createTestDoc(MedalsCollection, { name: '__test_medal_equiv', color: '#fff' });
    await createTestUser({ profile: { name: 'EquivA', medalIds: [medalId] } });
    await createTestUser({ profile: { name: 'EquivB', medalIds: [medalId] } });
    await createTestUser({ profile: { name: 'EquivC', medalIds: [medalId] } });

    const preview = (await callAs(adminUserId, 'integrity.preview', 'medals', medalId)) as {
      blockedBy: unknown[];
      pulled: Record<string, number>;
    };
    assert.deepStrictEqual(preview.blockedBy, []);
    assert.strictEqual(preview.pulled.members, 3);

    const executed = (await callAs(adminUserId, 'medals.remove', medalId)) as {
      effects: { pulled: Record<string, number> };
    };
    assert.strictEqual(executed.effects.pulled.members, 3, 'execute count must match preview count');
  });

  it('preview does not mutate — counts can be queried repeatedly without side effects', async () => {
    const medalId = await createTestDoc(MedalsCollection, { name: '__test_medal_no_mutate', color: '#fff' });
    const memberId = await createTestUser({ profile: { name: 'NoMutate', medalIds: [medalId] } });

    await callAs(adminUserId, 'integrity.preview', 'medals', medalId);
    await callAs(adminUserId, 'integrity.preview', 'medals', medalId);

    const member = await MembersCollection.findOneAsync(memberId);
    assert.deepStrictEqual(member?.profile?.medalIds, [medalId], 'preview must not mutate state');
  });

  it('idempotent execute — calling enforce twice produces no double-pull errors', async () => {
    const medalId = await createTestDoc(MedalsCollection, { name: '__test_medal_idempotent', color: '#fff' });
    await createTestUser({ profile: { name: 'IdemA', medalIds: [medalId] } });

    await enforceIntegrityOnDelete('medals', medalId, { userId: adminUserId });
    // Second call: the array no longer contains the id, so the count is 0
    // and the $pull is skipped. Must not throw.
    const second = await enforceIntegrityOnDelete('medals', medalId, { userId: adminUserId });
    assert.strictEqual(second.pulled.members ?? 0, 0);
  });

  it('deleting a Specialization pulls from both member arrays and self-referencing specialization arrays', async () => {
    const targetSpecId = await createTestDoc(SpecializationsCollection, { name: '__test_spec_target', color: '#fff' });
    const otherSpecId = await createTestDoc(SpecializationsCollection, {
      name: '__test_spec_consumer',
      color: '#fff',
      requiredSpecializations: [targetSpecId, 'unrelated'],
    });
    await createTestUser({ profile: { name: 'SpecA', specializationIds: [targetSpecId] } });
    await createTestUser({ profile: { name: 'SpecB', specializationIds: [targetSpecId, 'other'] } });

    const result = (await callAs(adminUserId, 'specializations.remove', targetSpecId)) as {
      effects: { pulled: Record<string, number> };
    };
    assert.strictEqual(result.effects.pulled.members, 2);
    assert.strictEqual(result.effects.pulled.specializations, 1);

    const survivingOtherSpec = await SpecializationsCollection.findOneAsync(otherSpecId);
    assert.deepStrictEqual(
      survivingOtherSpec?.requiredSpecializations,
      ['unrelated'],
      'self-referencing array should have target id pulled',
    );
  });

  it('multiple edges from same source accumulate into a single pulled-effect count', async () => {
    // Test the engine directly: deleting a Member fires pulls on
    // events.hosts, events.attendees, tasks.participants, tasks.completedBy,
    // specializations.instructors — accumulating into the per-source totals.
    // Goes via enforceIntegrityOnDelete because slice #168 (members custom
    // delete wiring) hasn't landed yet.
    const memberId = `${TEST_PREFIX}${Random.id()}`;
    await MembersCollection.insertAsync({
      _id: memberId,
      username: memberId,
      profile: { name: 'MultiEdgeMember' },
    });

    await createTestDoc(EventsCollection, {
      name: '__test_event_hosts',
      start: new Date(),
      end: new Date(),
      hosts: [memberId],
    });
    await createTestDoc(EventsCollection, {
      name: '__test_event_attendees',
      start: new Date(),
      end: new Date(),
      attendees: [memberId, 'other-member'],
    });
    await createTestDoc(EventsCollection, {
      name: '__test_event_both',
      start: new Date(),
      end: new Date(),
      hosts: [memberId],
      attendees: [memberId],
    });
    await createTestDoc(TasksCollection, { name: '__test_task_part', participants: [memberId] });
    await createTestDoc(TasksCollection, { name: '__test_task_compl', completedBy: [memberId] });

    const effects = await enforceIntegrityOnDelete('members', memberId, { userId: adminUserId });

    // 2 events have member in hosts (event_hosts + event_both)
    // 2 events have member in attendees (event_attendees + event_both)
    // → effects.pulled.events == 4 (operations, not distinct docs)
    assert.strictEqual(effects.pulled.events, 4, 'expected 4 event-pull operations across hosts + attendees');
    assert.strictEqual(effects.pulled.tasks, 2, 'expected 2 task-pull operations across participants + completedBy');

    // Verify actual DB state
    const remainingAttendees = await EventsCollection.findOneAsync({ name: '__test_event_attendees' });
    assert.deepStrictEqual(remainingAttendees?.attendees, ['other-member']);
    const bothEvent = await EventsCollection.findOneAsync({ name: '__test_event_both' });
    assert.deepStrictEqual(bothEvent?.hosts, []);
    assert.deepStrictEqual(bothEvent?.attendees, []);
  });
});
