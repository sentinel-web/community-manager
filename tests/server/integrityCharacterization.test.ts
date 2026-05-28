import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import EventsCollection from '../../imports/api/collections/events.collection';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import QuestionnairesCollection from '../../imports/api/collections/questionnaires.collection';
import QuestionnaireResponsesCollection from '../../imports/api/collections/questionnaireResponses.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import TaskStatusCollection from '../../imports/api/collections/taskStatus.collection';
import { enforceIntegrityOnDelete, previewIntegrity } from '../../server/integrity';
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
// CHARACTERIZATION tests for the referential-integrity engine (#267).
//
// These pin the EXISTING observable contract of the integrity triad
// (crud.lib.ts <-> integrity.ts <-> collection-registry.ts) so the
// "split integrity.ts + typed registry map" refactor can run with a
// safety net. They are intentionally redundant with the slice-level
// tests in integrity.test.ts — the point is that this file, taken as a
// whole, is the behaviour contract the refactor must preserve.
//
// Mapped business rules (from issue #267):
//   RULE-050 — FK on-delete state machine: block / pull / setNull / cascade.
//   RULE-051 — block primacy + preview-before-execute equivalence.
//   RULE-026 — FK-existence validation on insert / update.
//
// The write-validation describe block at the bottom pins the CURRENT
// touched-fields-only semantics (RULE-027). Decision O-6 supersedes that
// rule with full-document enforcement; the O-6 transition tests live in
// integrityFullDocEnforcement.test.ts and the two touched-fields-tolerance
// cases there are the ones that flip.
// ────────────────────────────────────────────────────────────

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

describe('integrity characterization — RULE-050 on-delete state machine', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([
      EventsCollection,
      EventTypesCollection,
      MedalsCollection,
      PositionsCollection,
      QuestionnairesCollection,
      QuestionnaireResponsesCollection,
      RanksCollection,
      SpecializationsCollection,
      TasksCollection,
      TaskStatusCollection,
    ]);
  });

  it('block: a referenced EventType cannot be deleted (state survives)', async () => {
    const typeId = await createTestDoc(EventTypesCollection, { name: '__char_et_block' });
    await createTestDoc(EventsCollection, {
      name: '__char_event_typed',
      start: new Date(),
      end: new Date(),
      eventType: typeId,
    });

    let captured: Meteor.Error | null = null;
    try {
      await callAs(adminUserId, 'eventTypes.remove', typeId);
    } catch (error) {
      captured = error as Meteor.Error;
    }

    assert.ok(captured, 'expected the delete to be blocked');
    assert.strictEqual(captured.error, 'foreign_key_blocked');
    const survivor = await EventTypesCollection.findOneAsync(typeId);
    assert.ok(survivor, 'blocked target must survive the delete attempt');
  });

  it('pull: deleting a Medal removes its id from every member array (array FK)', async () => {
    const medalId = await createTestDoc(MedalsCollection, { name: '__char_medal_pull', color: '#fff' });
    const holderId = await createTestUser({ profile: { name: 'CharPull', medalIds: [medalId, 'keep-me'] } });

    const result = (await callAs(adminUserId, 'medals.remove', medalId)) as {
      effects: { pulled: Record<string, number> };
    };
    assert.strictEqual(result.effects.pulled.members, 1);

    const holder = await MembersCollection.findOneAsync(holderId);
    assert.deepStrictEqual(holder?.profile?.medalIds, ['keep-me'], 'only the deleted id is pulled');
  });

  it('setNull: deleting a Position nulls members.profile.positionId (scalar FK)', async () => {
    const positionId = await createTestDoc(PositionsCollection, { name: '__char_pos_setnull' });
    const holderId = await createTestUser({ profile: { name: 'CharSetNull', positionId } });

    const result = (await callAs(adminUserId, 'positions.remove', positionId)) as {
      effects: { setNull: Record<string, number> };
    };
    assert.strictEqual(result.effects.setNull.members, 1);

    const holder = await MembersCollection.findOneAsync(holderId);
    assert.strictEqual(holder?.profile?.positionId, null);
  });

  it('cascade: deleting a Questionnaire deletes its Responses', async () => {
    const questionnaireId = await createTestDoc(QuestionnairesCollection, {
      name: '__char_q_cascade',
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

    const result = (await callAs(adminUserId, 'questionnaires.remove', questionnaireId)) as {
      effects: { cascaded: Record<string, number> };
    };
    assert.strictEqual(result.effects.cascaded.questionnaireResponses, 1);

    const gone = await QuestionnaireResponsesCollection.findOneAsync(responseId);
    assert.strictEqual(gone, undefined, 'cascaded child must be removed');
  });

  it('self-referential setNull: deleting a parent Task nulls children.parent', async () => {
    const parentId = await createTestDoc(TasksCollection, { name: '__char_parent_task' });
    const childId = await createTestDoc(TasksCollection, { name: '__char_child_task', parent: parentId });

    const result = (await callAs(adminUserId, 'tasks.remove', parentId)) as {
      effects: { setNull: Record<string, number> };
    };
    assert.strictEqual(result.effects.setNull.tasks, 1);

    const child = await TasksCollection.findOneAsync(childId);
    assert.strictEqual(child?.parent, null);
  });

  it('idempotent execute: enforcing a delete twice never double-mutates or throws', async () => {
    const medalId = await createTestDoc(MedalsCollection, { name: '__char_medal_idem', color: '#fff' });
    await createTestUser({ profile: { name: 'CharIdem', medalIds: [medalId] } });

    const first = await enforceIntegrityOnDelete('medals', medalId, { userId: adminUserId });
    assert.strictEqual(first.pulled.members, 1);
    const second = await enforceIntegrityOnDelete('medals', medalId, { userId: adminUserId });
    assert.strictEqual(second.pulled.members ?? 0, 0);
  });
});

describe('integrity characterization — RULE-051 block primacy + preview/execute equivalence', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([RanksCollection]);
  });

  it('block primacy: a blocker prevents the delete before any pull/setNull/cascade runs', async () => {
    // A rank referenced as a hard (block) rankId AND as a soft (setNull)
    // navyRankId on different members. The block must win — the delete is
    // refused and NO setNull mutation is applied.
    const rankId = await createTestDoc(RanksCollection, { name: '__char_rank_primacy', color: '#fff' });
    const blockerId = await createTestUser({ profile: { name: 'BlockHolder', rankId } });
    const softId = await createTestUser({ profile: { name: 'NavyHolder', navyRankId: rankId } });

    await assertRejectsWithCode(() => callAs(adminUserId, 'ranks.remove', rankId), 'foreign_key_blocked');

    const blocker = await MembersCollection.findOneAsync(blockerId);
    const soft = await MembersCollection.findOneAsync(softId);
    assert.strictEqual(blocker?.profile?.rankId, rankId, 'blocking reference untouched');
    assert.strictEqual(soft?.profile?.navyRankId, rankId, 'setNull must NOT fire when blocked (block primacy)');
  });

  it('preview reports the same blockers the execute path would surface', async () => {
    const rankId = await createTestDoc(RanksCollection, { name: '__char_rank_equiv', color: '#fff' });
    await createTestUser({ profile: { name: 'EquivHolder', rankId } });

    const preview = (await callAs(adminUserId, 'integrity.preview', 'ranks', rankId)) as IntegrityPreview;
    assert.strictEqual(preview.blockedBy.length, 1);

    let executeError: Meteor.Error | null = null;
    try {
      await callAs(adminUserId, 'ranks.remove', rankId);
    } catch (error) {
      executeError = error as Meteor.Error;
    }
    assert.ok(executeError);
    const executeBlockers = (executeError.details as { blockedBy: BlockedByEntry[] }).blockedBy;
    assert.strictEqual(preview.blockedBy[0].source, executeBlockers[0].source);
    assert.strictEqual(preview.blockedBy[0].count, executeBlockers[0].count);
  });

  it('preview is read-only: querying it never mutates the database', async () => {
    const rankId = await createTestDoc(RanksCollection, { name: '__char_rank_readonly', color: '#fff' });
    const memberId = await createTestUser({ profile: { name: 'ReadOnly', navyRankId: rankId } });

    await previewIntegrity('ranks', rankId, { userId: adminUserId });
    await previewIntegrity('ranks', rankId, { userId: adminUserId });

    const member = await MembersCollection.findOneAsync(memberId);
    assert.strictEqual(member?.profile?.navyRankId, rankId, 'preview must not setNull');
  });
});

describe('integrity characterization — RULE-026 write-time FK existence', () => {
  let adminUserId: string;
  let validRankId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
    validRankId = await createTestDoc(RanksCollection, { name: '__char_wv_rank', color: '#fff' });
  });

  after(async () => {
    await cleanupFixtures([RanksCollection, SpecializationsCollection, TaskStatusCollection, TasksCollection]);
  });

  it('insert with a valid scalar FK succeeds', async () => {
    const id = (await callAs(adminUserId, 'specializations.insert', {
      name: '__char_wv_insert_ok',
      requiredRankId: validRankId,
    })) as string;
    assert.ok(id);
  });

  it('insert with a non-existent scalar FK is rejected', async () => {
    await assertRejectsWithCode(
      () =>
        callAs(adminUserId, 'specializations.insert', {
          name: '__char_wv_insert_bad',
          requiredRankId: 'no-such-rank',
        }),
      'foreign_key_invalid',
    );
  });

  it('insert with a non-existent array FK element is rejected', async () => {
    const statusId = await createTestDoc(TaskStatusCollection, { name: '__char_wv_status' });
    await assertRejectsWithCode(
      () =>
        callAs(adminUserId, 'tasks.insert', {
          name: '__char_wv_task_bad',
          status: statusId,
          participants: ['no-such-member'],
        }),
      'foreign_key_invalid',
    );
  });

  it('update rewriting a scalar FK to a stale value is rejected', async () => {
    const specId = await createTestDoc(SpecializationsCollection, { name: '__char_wv_update_bad' });
    await assertRejectsWithCode(
      () => callAs(adminUserId, 'specializations.update', specId, { requiredRankId: 'no-such-rank' }),
      'foreign_key_invalid',
    );
  });

  it('update rewriting a scalar FK to a valid value succeeds', async () => {
    const specId = await createTestDoc(SpecializationsCollection, { name: '__char_wv_update_good' });
    await callAs(adminUserId, 'specializations.update', specId, { requiredRankId: validRankId });
    const doc = await SpecializationsCollection.findOneAsync(specId);
    assert.strictEqual(doc?.requiredRankId, validRankId);
  });
});

// ────────────────────────────────────────────────────────────
// RULE-027 (touched-fields-only) — CURRENT behaviour, pre-O-6.
//
// This block documents the state-of-the-world the refactor inherits. The
// SAME scenarios appear (inverted) in integrityFullDocEnforcement.test.ts,
// which pins the post-O-6 behaviour. Keeping both makes the semantic flip
// auditable in the diff.
// ────────────────────────────────────────────────────────────
describe('integrity characterization — RULE-027 touched-fields tolerance (PRE-O-6 baseline)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([SpecializationsCollection]);
  });

  it('editing an unrelated field on a doc with a pre-existing orphan FK is tolerated', async () => {
    // Direct-write a stale FK (bypassing insert validation) to simulate a
    // pre-existing orphan, then rename via the method. Under touched-fields
    // semantics the untouched orphan FK does not block the edit.
    const specId = `${TEST_PREFIX}${Random.id()}`;
    await SpecializationsCollection.insertAsync({
      _id: specId,
      name: '__char_orphan_holder',
      requiredRankId: 'rank-that-was-deleted',
    });

    await callAs(adminUserId, 'specializations.update', specId, { name: '__char_orphan_renamed' });

    const doc = await SpecializationsCollection.findOneAsync(specId);
    assert.strictEqual(doc?.name, '__char_orphan_renamed');
    assert.strictEqual(doc?.requiredRankId, 'rank-that-was-deleted', 'untouched orphan FK preserved');
  });
});
