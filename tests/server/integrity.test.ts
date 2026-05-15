import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import DiscoveryTypesCollection from '../../imports/api/collections/discoveryTypes.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import LogsCollection from '../../imports/api/collections/logs.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import QuestionnaireResponsesCollection from '../../imports/api/collections/questionnaireResponses.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import ProfilePicturesCollection from '../../imports/api/collections/profilePictures.collection';
import QuestionnairesCollection from '../../imports/api/collections/questionnaires.collection';
import { COLLECTION_REGISTRY, type ForeignKeyEdge } from '../../server/collection-registry';
import { enforceIntegrityOnDelete, extractWrittenFKs, resetIncomingEdgesCache } from '../../server/integrity';
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

describe('integrity layer — setNull primitive on scalar foreign keys (#164)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([
      DiscoveryTypesCollection,
      PositionsCollection,
      QuestionnaireResponsesCollection,
      RanksCollection,
      RegistrationsCollection,
      SpecializationsCollection,
      SquadsCollection,
      TasksCollection,
    ]);
  });

  it('deleting a Position clears members.profile.positionId on every holder', async () => {
    const positionId = await createTestDoc(PositionsCollection, { name: '__test_position_pull' });
    const holderIds = await Promise.all([
      createTestUser({ profile: { name: 'PosA', positionId } }),
      createTestUser({ profile: { name: 'PosB', positionId } }),
    ]);
    await createTestUser({ profile: { name: 'PosUnaffected' } });

    const result = (await callAs(adminUserId, 'positions.remove', positionId)) as {
      effects: { setNull: Record<string, number> };
    };
    assert.strictEqual(result.effects.setNull.members, 2);

    for (const id of holderIds) {
      const member = await MembersCollection.findOneAsync(id);
      assert.strictEqual(member?.profile?.positionId, null);
    }
  });

  it('deleting a DiscoveryType nulls Registrations.discoveryType', async () => {
    const dtId = await createTestDoc(DiscoveryTypesCollection, { name: '__test_dt_setnull' });
    const regId = await createTestDoc(RegistrationsCollection, {
      name: 'Reg Person',
      id: 1234,
      age: 18,
      discoveryType: dtId,
      rulesReadAndAccepted: true,
    });

    const result = (await callAs(adminUserId, 'discoveryTypes.remove', dtId)) as {
      effects: { setNull: Record<string, number> };
    };
    assert.strictEqual(result.effects.setNull.registrations, 1);

    const reg = await RegistrationsCollection.findOneAsync(regId);
    assert.strictEqual(reg?.discoveryType, null);
  });

  it('self-ref: deleting a parent Task nulls children.parent (children become roots)', async () => {
    const parentTaskId = await createTestDoc(TasksCollection, { name: '__test_parent_task' });
    const childAId = await createTestDoc(TasksCollection, { name: '__test_child_a', parent: parentTaskId });
    const childBId = await createTestDoc(TasksCollection, { name: '__test_child_b', parent: parentTaskId });
    await createTestDoc(TasksCollection, { name: '__test_unrelated', parent: 'some-other-task' });

    const result = (await callAs(adminUserId, 'tasks.remove', parentTaskId)) as {
      effects: { setNull: Record<string, number> };
    };
    assert.strictEqual(result.effects.setNull.tasks, 2);

    const childA = await TasksCollection.findOneAsync(childAId);
    const childB = await TasksCollection.findOneAsync(childBId);
    assert.strictEqual(childA?.parent, null);
    assert.strictEqual(childB?.parent, null);
  });

  it('self-ref: deleting a parent Squad nulls children.parentSquadId', async () => {
    const parentSquadId = await createTestDoc(SquadsCollection, { name: '__test_parent_squad' });
    const childSquadId = await createTestDoc(SquadsCollection, {
      name: '__test_child_squad',
      parentSquadId,
    });

    const result = (await callAs(adminUserId, 'squads.remove', parentSquadId)) as {
      effects: { setNull: Record<string, number> };
    };
    assert.strictEqual(result.effects.setNull.squads, 1);

    const childSquad = await SquadsCollection.findOneAsync(childSquadId);
    assert.strictEqual(childSquad?.parentSquadId, null);
  });

  it('rank deletion: nulls adjacent previousRankId / nextRankId in the chain', async () => {
    const targetRankId = await createTestDoc(RanksCollection, { name: '__test_rank_chain_mid', color: '#fff' });
    const previousRankId = await createTestDoc(RanksCollection, {
      name: '__test_rank_chain_prev',
      color: '#fff',
      nextRankId: targetRankId,
    });
    const nextRankId = await createTestDoc(RanksCollection, {
      name: '__test_rank_chain_next',
      color: '#fff',
      previousRankId: targetRankId,
    });

    const result = (await callAs(adminUserId, 'ranks.remove', targetRankId)) as {
      effects: { setNull: Record<string, number> };
    };
    assert.strictEqual(result.effects.setNull.ranks, 2, 'expected both adjacent ranks to be nulled');

    const prev = await RanksCollection.findOneAsync(previousRankId);
    const next = await RanksCollection.findOneAsync(nextRankId);
    assert.strictEqual(prev?.nextRankId, null);
    assert.strictEqual(next?.previousRankId, null);
  });

  it('multi-primitive: deleting a Rank with members holding it as navy + an adjacent rank fires setNull on both edges', async () => {
    const targetRankId = await createTestDoc(RanksCollection, { name: '__test_rank_multi', color: '#fff' });
    await createTestUser({ profile: { name: 'NavyHolderA', navyRankId: targetRankId } });
    await createTestUser({ profile: { name: 'NavyHolderB', navyRankId: targetRankId } });
    await createTestDoc(RanksCollection, {
      name: '__test_rank_multi_prev',
      color: '#fff',
      nextRankId: targetRankId,
    });
    await createTestDoc(SpecializationsCollection, {
      name: '__test_spec_req',
      color: '#fff',
      requiredRankId: targetRankId,
    });

    const result = (await callAs(adminUserId, 'ranks.remove', targetRankId)) as {
      effects: { setNull: Record<string, number> };
    };
    assert.strictEqual(result.effects.setNull.members, 2);
    assert.strictEqual(result.effects.setNull.ranks, 1);
    assert.strictEqual(result.effects.setNull.specializations, 1);
  });

  it('audit log records cascadeEffects.setNull when a delete triggers nulls', async () => {
    const positionId = await createTestDoc(PositionsCollection, { name: '__test_pos_audit' });
    await createTestUser({ profile: { name: 'AuditPos', positionId } });

    await callAs(adminUserId, 'positions.remove', positionId);

    const log = await findLatestAuditLog('positions.deleted', positionId);
    assert.ok(log, 'expected audit log for position delete');
    const cascadeEffects = (log.payload as Record<string, unknown>).cascadeEffects as
      | { setNull: Record<string, number> }
      | undefined;
    assert.ok(cascadeEffects, 'expected cascadeEffects in audit payload');
    assert.strictEqual(cascadeEffects.setNull.members, 1);
  });

  it('preview reports setNull counts without mutating', async () => {
    const positionId = await createTestDoc(PositionsCollection, { name: '__test_pos_preview' });
    const memberId = await createTestUser({ profile: { name: 'PrevPreview', positionId } });

    const preview = (await callAs(adminUserId, 'integrity.preview', 'positions', positionId)) as {
      blockedBy: unknown[];
      setNull: Record<string, number>;
    };
    assert.deepStrictEqual(preview.blockedBy, []);
    assert.strictEqual(preview.setNull.members, 1);

    const memberStill = await MembersCollection.findOneAsync(memberId);
    assert.strictEqual(memberStill?.profile?.positionId, positionId, 'preview must not mutate');
  });

  it('idempotent execute — second enforce produces zero setNull count', async () => {
    const positionId = await createTestDoc(PositionsCollection, { name: '__test_pos_idem' });
    await createTestUser({ profile: { name: 'IdemSetNull', positionId } });

    const first = await enforceIntegrityOnDelete('positions', positionId, { userId: adminUserId });
    assert.strictEqual(first.setNull.members, 1);

    const second = await enforceIntegrityOnDelete('positions', positionId, { userId: adminUserId });
    assert.strictEqual(second.setNull.members ?? 0, 0);
  });
});

describe('integrity layer — cascade primitive + recursive cycle detection (#165)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([
      MedalsCollection,
      QuestionnairesCollection,
      QuestionnaireResponsesCollection,
    ]);
  });

  it('deleting a Questionnaire cascades to delete all its Responses', async () => {
    const questionnaireId = await createTestDoc(QuestionnairesCollection, {
      name: '__test_q_cascade',
      questions: [],
      status: 'closed',
      allowAnonymous: true,
      interval: 'once',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const responseIds = await Promise.all([
      createTestDoc(QuestionnaireResponsesCollection, {
        questionnaireId,
        respondentId: null,
        answers: [],
        submittedAt: new Date(),
      }),
      createTestDoc(QuestionnaireResponsesCollection, {
        questionnaireId,
        respondentId: null,
        answers: [],
        submittedAt: new Date(),
      }),
      createTestDoc(QuestionnaireResponsesCollection, {
        questionnaireId,
        respondentId: null,
        answers: [],
        submittedAt: new Date(),
      }),
    ]);
    // Unrelated response on a different questionnaire should survive.
    const unrelatedId = await createTestDoc(QuestionnaireResponsesCollection, {
      questionnaireId: 'other-questionnaire',
      respondentId: null,
      answers: [],
      submittedAt: new Date(),
    });

    const result = (await callAs(adminUserId, 'questionnaires.remove', questionnaireId)) as {
      effects: { cascaded: Record<string, number> };
    };
    assert.strictEqual(result.effects.cascaded.questionnaireResponses, 3);

    for (const id of responseIds) {
      const gone = await QuestionnaireResponsesCollection.findOneAsync(id);
      assert.strictEqual(gone, undefined, `response ${id} should be cascade-deleted`);
    }
    const unrelatedStill = await QuestionnaireResponsesCollection.findOneAsync(unrelatedId);
    assert.ok(unrelatedStill, 'unrelated response must survive');
  });

  it('audit log records cascadeEffects.cascaded with the affected count', async () => {
    const questionnaireId = await createTestDoc(QuestionnairesCollection, {
      name: '__test_q_audit',
      questions: [],
      status: 'closed',
      allowAnonymous: true,
      interval: 'once',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createTestDoc(QuestionnaireResponsesCollection, {
      questionnaireId,
      respondentId: null,
      answers: [],
      submittedAt: new Date(),
    });

    await callAs(adminUserId, 'questionnaires.remove', questionnaireId);

    const log = await findLatestAuditLog('questionnaires.deleted', questionnaireId);
    assert.ok(log, 'expected audit log for questionnaire delete');
    const cascadeEffects = (log.payload as Record<string, unknown>).cascadeEffects as
      | { cascaded: Record<string, number> }
      | undefined;
    assert.ok(cascadeEffects, 'expected cascadeEffects to appear');
    assert.strictEqual(cascadeEffects.cascaded.questionnaireResponses, 1);
  });

  it('preview reports cascade count without deleting anything', async () => {
    const questionnaireId = await createTestDoc(QuestionnairesCollection, {
      name: '__test_q_preview',
      questions: [],
      status: 'closed',
      allowAnonymous: true,
      interval: 'once',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const responseId = await createTestDoc(QuestionnaireResponsesCollection, {
      questionnaireId,
      respondentId: null,
      answers: [],
      submittedAt: new Date(),
    });

    const preview = (await callAs(adminUserId, 'integrity.preview', 'questionnaires', questionnaireId)) as {
      cascaded: Record<string, number>;
    };
    assert.strictEqual(preview.cascaded.questionnaireResponses, 1);

    const responseStill = await QuestionnaireResponsesCollection.findOneAsync(responseId);
    assert.ok(responseStill, 'preview must not delete the cascaded children');
  });

  it('cycle detection: a self-pointing cascade edge terminates rather than infinite-loops', async () => {
    // Inject a synthetic self-referential cascade edge into the registry,
    // then reset the inverted-edges cache so the engine picks it up. Use
    // medals because it has no real foreign keys today — least invasive.
    // The edge { _id → medals (cascade) } makes "the doc whose _id matches
    // the target id" a cascade child, which is the target itself. The
    // visited-set should prevent infinite recursion.
    const medalsEntry = COLLECTION_REGISTRY.medals as { foreignKeys?: readonly ForeignKeyEdge[] };
    const original = medalsEntry.foreignKeys;
    medalsEntry.foreignKeys = [
      { field: '_id', target: 'medals', kind: 'scalar', onDelete: 'cascade' },
    ];
    resetIncomingEdgesCache();

    try {
      const medalId = await createTestDoc(MedalsCollection, { name: '__test_cycle_probe', color: '#fff' });
      const start = Date.now();
      const effects = await enforceIntegrityOnDelete('medals', medalId, { userId: adminUserId });
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 2000, `cycle detection must terminate quickly (was ${elapsed}ms)`);
      // The visited-set short-circuits the inner recursion before any
      // cascaded count is recorded, but the outer level still records the
      // direct child it found (which is the doc itself).
      assert.strictEqual(effects.cascaded.medals, 1);
    } finally {
      medalsEntry.foreignKeys = original;
      resetIncomingEdgesCache();
    }
  });

  it('preview/execute equivalence for cascade', async () => {
    const questionnaireId = await createTestDoc(QuestionnairesCollection, {
      name: '__test_q_equiv',
      questions: [],
      status: 'closed',
      allowAnonymous: true,
      interval: 'once',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createTestDoc(QuestionnaireResponsesCollection, {
      questionnaireId,
      respondentId: null,
      answers: [],
      submittedAt: new Date(),
    });
    await createTestDoc(QuestionnaireResponsesCollection, {
      questionnaireId,
      respondentId: null,
      answers: [],
      submittedAt: new Date(),
    });

    const preview = (await callAs(adminUserId, 'integrity.preview', 'questionnaires', questionnaireId)) as {
      cascaded: Record<string, number>;
    };
    const executed = (await callAs(adminUserId, 'questionnaires.remove', questionnaireId)) as {
      effects: { cascaded: Record<string, number> };
    };
    assert.strictEqual(preview.cascaded.questionnaireResponses, executed.effects.cascaded.questionnaireResponses);
  });
});

describe('integrity layer — write-time foreign-key validation (#166)', () => {
  let adminUserId: string;
  let validRankId: string;
  let validSpecId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
    validRankId = await createTestDoc(RanksCollection, { name: '__test_wv_rank', color: '#fff' });
    validSpecId = await createTestDoc(SpecializationsCollection, { name: '__test_wv_spec_a', color: '#fff' });
  });

  after(async () => {
    await cleanupFixtures([RanksCollection, SpecializationsCollection, TasksCollection]);
  });

  describe('extractWrittenFKs — modifier-shape inspection (unit-style)', () => {
    it('returns no entries for a collection without foreign keys', () => {
      const result = extractWrittenFKs('medals', { $set: { name: 'x' } });
      assert.deepStrictEqual(result, []);
    });

    it('returns only the FKs actually mentioned in $set (touched-fields only)', () => {
      const result = extractWrittenFKs('specializations', { $set: { name: 'x' } });
      assert.deepStrictEqual(result, [], 'unrelated field should not surface any FKs');
    });

    it('extracts a scalar FK from $set', () => {
      const result = extractWrittenFKs('specializations', { $set: { requiredRankId: 'rank-x' } });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].edge.field, 'requiredRankId');
      assert.strictEqual(result[0].value, 'rank-x');
    });

    it('extracts every array element from $set on an array FK', () => {
      const result = extractWrittenFKs('specializations', {
        $set: { requiredSpecializations: ['a', 'b', 'c'] },
      });
      assert.strictEqual(result.length, 3);
      assert.deepStrictEqual(
        result.map(r => r.value),
        ['a', 'b', 'c'],
      );
    });

    it('extracts a single $push value', () => {
      const result = extractWrittenFKs('specializations', {
        $push: { requiredSpecializations: 'new-spec' },
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].value, 'new-spec');
    });

    it('extracts $push with $each variant', () => {
      const result = extractWrittenFKs('specializations', {
        $push: { requiredSpecializations: { $each: ['a', 'b'] } },
      });
      assert.deepStrictEqual(
        result.map(r => r.value),
        ['a', 'b'],
      );
    });

    it('skips $unset and $pull (clearing/removing is always valid)', () => {
      const unsetResult = extractWrittenFKs('specializations', { $unset: { requiredRankId: '' } });
      assert.deepStrictEqual(unsetResult, []);
      const pullResult = extractWrittenFKs('specializations', { $pull: { requiredSpecializations: 'x' } });
      assert.deepStrictEqual(pullResult, []);
    });

    it('skips a $set: null on a scalar FK (clearing is valid)', () => {
      const result = extractWrittenFKs('specializations', { $set: { requiredRankId: null } });
      assert.deepStrictEqual(result, []);
    });

    it('bare-doc insert yields every present FK', () => {
      const result = extractWrittenFKs('specializations', {
        name: 'x',
        requiredRankId: 'rank-x',
        instructors: ['m1', 'm2'],
      });
      assert.strictEqual(result.length, 3);
    });
  });

  describe('CRUD .insert validation', () => {
    it('insert with valid FK references succeeds', async () => {
      const id = (await callAs(adminUserId, 'specializations.insert', {
        name: '__test_wv_insert_ok',
        requiredRankId: validRankId,
      })) as string;
      assert.ok(id);
    });

    it('insert with a non-existent scalar FK throws foreign_key_invalid', async () => {
      await assertRejectsWithCode(
        () =>
          callAs(adminUserId, 'specializations.insert', {
            name: '__test_wv_insert_bad_rank',
            requiredRankId: 'definitely-not-a-real-rank',
          }),
        'foreign_key_invalid',
      );
    });

    it('insert with a non-existent array FK element throws foreign_key_invalid', async () => {
      await assertRejectsWithCode(
        () =>
          callAs(adminUserId, 'specializations.insert', {
            name: '__test_wv_insert_bad_spec',
            requiredSpecializations: [validSpecId, 'fake-spec'],
          }),
        'foreign_key_invalid',
      );
    });
  });

  describe('CRUD .update validation — touched-fields only', () => {
    it('update of an unrelated field on a doc with a pre-existing orphan succeeds', async () => {
      // Manually create a Specialization with a stale requiredRankId (bypass
      // insert validation by writing directly to the collection). Then
      // update an unrelated field via the method — should NOT fail.
      const specId = await createTestDoc(SpecializationsCollection, {
        name: '__test_wv_orphan_holder',
        requiredRankId: 'stale-rank-that-never-existed',
      });
      await callAs(adminUserId, 'specializations.update', specId, { name: '__test_wv_orphan_renamed' });

      const doc = await SpecializationsCollection.findOneAsync(specId);
      assert.strictEqual(doc?.name, '__test_wv_orphan_renamed');
      assert.strictEqual(doc?.requiredRankId, 'stale-rank-that-never-existed', 'orphan field preserved');
    });

    it('update that rewrites a scalar FK to a stale value throws foreign_key_invalid', async () => {
      const specId = await createTestDoc(SpecializationsCollection, { name: '__test_wv_update_bad' });
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'specializations.update', specId, { requiredRankId: 'fake-rank' }),
        'foreign_key_invalid',
      );
    });

    it('update that rewrites a scalar FK to a valid value succeeds', async () => {
      const specId = await createTestDoc(SpecializationsCollection, { name: '__test_wv_update_good' });
      await callAs(adminUserId, 'specializations.update', specId, { requiredRankId: validRankId });
      const doc = await SpecializationsCollection.findOneAsync(specId);
      assert.strictEqual(doc?.requiredRankId, validRankId);
    });

    it('update that adds a stale array element throws foreign_key_invalid', async () => {
      const specId = await createTestDoc(SpecializationsCollection, { name: '__test_wv_update_array' });
      await assertRejectsWithCode(
        () =>
          callAs(adminUserId, 'specializations.update', specId, {
            requiredSpecializations: [validSpecId, 'fake-spec-x'],
          }),
        'foreign_key_invalid',
      );
    });
  });
});

describe('integrity layer — members.remove custom path + ProfilePicture owned-target (#168)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([
      EventsCollection,
      ProfilePicturesCollection,
      QuestionnaireResponsesCollection,
      SpecializationsCollection,
      TasksCollection,
    ]);
  });

  it('deleting a member via members.remove pulls them from events/tasks/specializations + nulls response respondentId', async () => {
    const victimId = await createTestUser({ profile: { name: 'Victim' } });
    await createTestDoc(EventsCollection, {
      name: '__test_mr_event',
      start: new Date(),
      end: new Date(),
      hosts: [victimId],
      attendees: [victimId],
    });
    await createTestDoc(TasksCollection, {
      name: '__test_mr_task',
      participants: [victimId],
      completedBy: [victimId],
    });
    await createTestDoc(SpecializationsCollection, {
      name: '__test_mr_spec',
      instructors: [victimId],
    });
    const responseId = await createTestDoc(QuestionnaireResponsesCollection, {
      questionnaireId: 'some-q',
      respondentId: victimId,
      answers: [],
      submittedAt: new Date(),
    });

    const result = (await callAs(adminUserId, 'members.remove', victimId)) as {
      id: string;
      effects: { pulled: Record<string, number>; setNull: Record<string, number> };
    };

    assert.strictEqual(result.id, victimId);
    assert.strictEqual(result.effects.pulled.events, 2, 'events.hosts + events.attendees');
    assert.strictEqual(result.effects.pulled.tasks, 2, 'tasks.participants + tasks.completedBy');
    assert.strictEqual(result.effects.pulled.specializations, 1, 'specializations.instructors');
    assert.strictEqual(result.effects.setNull.questionnaireResponses, 1, 'respondentId nulled');

    const member = await MembersCollection.findOneAsync(victimId);
    assert.strictEqual(member, undefined, 'member should be removed');
    const response = await QuestionnaireResponsesCollection.findOneAsync(responseId);
    assert.strictEqual(response?.respondentId, null);
  });

  it('member with a ProfilePicture: the picture is deleted as owned-target cascade', async () => {
    const pictureId = await createTestDoc(ProfilePicturesCollection, { value: 'data:image/png;base64,xxx' });
    const memberId = await createTestUser({ profile: { name: 'WithPicture', profilePictureId: pictureId } });

    const result = (await callAs(adminUserId, 'members.remove', memberId)) as {
      effects: { cascaded: Record<string, number> };
    };
    assert.strictEqual(result.effects.cascaded.profilePictures, 1);

    const picture = await ProfilePicturesCollection.findOneAsync(pictureId);
    assert.strictEqual(picture, undefined, 'owned profile picture should be deleted');
  });

  it('member without a ProfilePicture: delete still succeeds, cascaded.profilePictures unset', async () => {
    const memberId = await createTestUser({ profile: { name: 'NoPicture' } });

    const result = (await callAs(adminUserId, 'members.remove', memberId)) as {
      effects: { cascaded: Record<string, number> };
    };
    assert.strictEqual(result.effects.cascaded.profilePictures ?? 0, 0);
  });

  it('audit log records cascadeEffects when members.remove fires integrity primitives', async () => {
    const memberId = await createTestUser({ profile: { name: 'AuditedMember' } });
    await createTestDoc(EventsCollection, {
      name: '__test_audit_event',
      start: new Date(),
      end: new Date(),
      hosts: [memberId],
    });

    await callAs(adminUserId, 'members.remove', memberId);

    const log = await findLatestAuditLog('members.deleted', memberId);
    assert.ok(log, 'expected audit log for member delete');
    const cascadeEffects = (log.payload as Record<string, unknown>).cascadeEffects as
      | { pulled: Record<string, number> }
      | undefined;
    assert.ok(cascadeEffects, 'expected cascadeEffects in audit payload');
    assert.strictEqual(cascadeEffects.pulled.events, 1);
  });
});
