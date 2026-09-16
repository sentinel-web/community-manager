import assert from 'node:assert';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';
import LogsCollection from '../../imports/api/collections/logs.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import ProfilePicturesCollection from '../../imports/api/collections/profilePictures.collection';
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

interface BulkRemoveResult {
  removed: number;
  errors: string[];
}

// Targets the bespoke methods in server/apis/members.server.ts that are being
// migrated onto the mutation-pipeline wrapper one slice at a time. Each test
// here asserts an invariant that the legacy try/catch antipattern violated —
// see PRD #97 user story 7.

describe('members.insert — migrated to mutation-pipeline (#100)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('body error from Accounts.createUserAsync propagates with original Meteor.Error code intact', async () => {
    // Legacy antipattern: catch and rethrow as `new Meteor.Error(error.message)`,
    // which collapsed the original error code into the message-position-as-code.
    // After migration, the original error must reach the caller untouched.
    const original = Accounts.createUserAsync;
    (Accounts as unknown as { createUserAsync: unknown }).createUserAsync = async () => {
      throw new Meteor.Error('test-original-code', 'test-original-message');
    };
    try {
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'members.insert', { username: `${TEST_PREFIX}propagation_probe` }),
        'test-original-code',
      );
    } finally {
      (Accounts as unknown as { createUserAsync: typeof original }).createUserAsync = original;
    }
  });

  it('successful insert does not log the password (redact list applied)', async () => {
    const username = `${TEST_PREFIX}redact_probe_${Math.random().toString(36).slice(2, 8)}`;
    const insertedId = (await callAs(adminUserId, 'members.insert', {
      username,
      password: 'this-must-not-appear-in-logs',
      profile: { name: 'Redact Probe' },
    })) as string;
    assert.ok(insertedId, 'Expected insert to return a member id');

    const log = (await LogsCollection.findOneAsync(
      { action: 'members.created', 'payload.id': insertedId },
      { sort: { createdAt: -1 } },
    )) as { payload: Record<string, unknown> } | undefined;
    assert.ok(log, 'Expected a members.created audit entry');
    assert.strictEqual(log.payload.password, undefined, 'Audit payload must not contain the password');
    assert.strictEqual(log.payload.username, username, 'Audit payload should still carry the username');
    assert.strictEqual(log.payload.id, insertedId);

    // Cleanup the user we just created (cleanupFixtures only catches test-prefixed _ids,
    // but Accounts.createUserAsync generates its own id — remove explicitly).
    await Meteor.users.removeAsync({ _id: insertedId });
  });
});

describe('members.update — migrated to mutation-pipeline (#101)', () => {
  let adminUserId: string;
  let targetUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
    targetUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('body error from MembersCollection.updateAsync propagates with original Meteor.Error code intact', async () => {
    // Targets the legacy `try { ... updateAsync ... } catch (e) { throw new Meteor.Error(e.message) }`
    // wrapper specifically — the antipattern only obscured errors thrown inside that block.
    const originalUpdate = MembersCollection.updateAsync.bind(MembersCollection);
    (MembersCollection as unknown as { updateAsync: unknown }).updateAsync = async () => {
      throw new Meteor.Error('test-update-code', 'test-update-message');
    };
    try {
      await assertRejectsWithCode(
        () =>
          callAs(adminUserId, 'members.update', targetUserId, { 'profile.description': 'probe' }),
        'test-update-code',
      );
    } finally {
      (MembersCollection as unknown as { updateAsync: typeof originalUpdate }).updateAsync = originalUpdate;
    }
  });
});

describe('members.findOne — returns undefined on miss (#122)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('returns undefined when no member matches the filter (no throw)', async () => {
    // Regression: previously threw Meteor.Error(404, 'Member not found') on miss,
    // which surfaced as an unhandled rejection in RegistrationExtra (one per row)
    // and triggered the dev-server overlay, blocking e2e clicks on /registrations.
    const result = await callAs(adminUserId, 'members.findOne', { 'profile.registrationId': 'nonexistent' });
    assert.strictEqual(result, undefined);
  });

  it('returns the member when one matches the filter', async () => {
    const result = await callAs(adminUserId, 'members.findOne', { _id: adminUserId });
    assert.ok(result, 'Expected the admin user to be returned');
    assert.strictEqual((result as { _id: string })._id, adminUserId);
  });
});

describe('members.participantNames — legacy try/catch removed (#97)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('body error from MembersCollection.find propagates with original Meteor.Error code intact', async () => {
    // Defends against the legacy `try { ... } catch (e) { throw new Meteor.Error(e.message) }`
    // wrapper sneaking back in — it would clobber the original error code into the
    // message position. Read methods stay outside the runMutation pipeline.
    const originalFind = MembersCollection.find.bind(MembersCollection);
    (MembersCollection as unknown as { find: unknown }).find = () => {
      throw new Meteor.Error('test-participant-names-code', 'test-participant-names-message');
    };
    try {
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'members.participantNames', {}, {}),
        'test-participant-names-code',
      );
    } finally {
      (MembersCollection as unknown as { find: typeof originalFind }).find = originalFind;
    }
  });
});

describe('members.remove — migrated to mutation-pipeline (#102)', () => {
  let adminUserId: string;
  let targetUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
    targetUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('body error from MembersCollection.removeAsync propagates with original Meteor.Error code intact', async () => {
    const originalRemove = MembersCollection.removeAsync.bind(MembersCollection);
    (MembersCollection as unknown as { removeAsync: unknown }).removeAsync = async () => {
      throw new Meteor.Error('test-remove-code', 'test-remove-message');
    };
    try {
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'members.remove', targetUserId),
        'test-remove-code',
      );
    } finally {
      (MembersCollection as unknown as { removeAsync: typeof originalRemove }).removeAsync = originalRemove;
    }
  });
});

describe('members.bulkRemove — per-id members.remove semantics (#360)', () => {
  let adminUserId: string;
  let noDeleteUserId: string;

  before(async () => {
    const [adminRoleId, noDeleteRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ members: { read: true, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, noDeleteUserId] = await Promise.all([createTestUser({ roleId: adminRoleId }), createTestUser({ roleId: noDeleteRoleId })]);
  });

  after(async () => {
    await cleanupFixtures([EventsCollection, ProfilePicturesCollection]);
  });

  it('removes every selected member and returns { removed, errors }', async () => {
    const [firstId, secondId] = await Promise.all([createTestUser(), createTestUser()]);

    const result = (await callAs(adminUserId, 'members.bulkRemove', [firstId, secondId])) as BulkRemoveResult;

    assert.deepStrictEqual(result, { removed: 2, errors: [] });
    assert.strictEqual(await MembersCollection.findOneAsync(firstId), undefined);
    assert.strictEqual(await MembersCollection.findOneAsync(secondId), undefined);
  });

  it('writes one members.deleted audit entry per removed id', async () => {
    const [firstId, secondId] = await Promise.all([createTestUser(), createTestUser()]);

    await callAs(adminUserId, 'members.bulkRemove', [firstId, secondId]);

    assert.ok(await findLatestAuditLog('members.deleted', firstId), 'expected audit entry for first id');
    assert.ok(await findLatestAuditLog('members.deleted', secondId), 'expected audit entry for second id');
  });

  it('runs the integrity layer and the owned profile-picture cascade for each id', async () => {
    const pictureId = await createTestDoc(ProfilePicturesCollection, { value: 'data:image/png;base64,xxx' });
    const memberId = await createTestUser({ profile: { profilePictureId: pictureId } });
    const eventId = await createTestDoc(EventsCollection, {
      name: '__test_bulk_member_event',
      start: new Date(),
      end: new Date(),
      hosts: [memberId],
      attendees: [memberId],
    });

    const result = (await callAs(adminUserId, 'members.bulkRemove', [memberId])) as BulkRemoveResult;

    assert.deepStrictEqual(result, { removed: 1, errors: [] });
    assert.strictEqual(await ProfilePicturesCollection.findOneAsync(pictureId), undefined, 'owned profile picture should be deleted');
    const event = await EventsCollection.findOneAsync(eventId);
    assert.deepStrictEqual(event?.hosts, []);
    assert.deepStrictEqual(event?.attendees, []);
  });

  it('refuses self-deletion per id while still removing the other members', async () => {
    const otherId = await createTestUser();

    const result = (await callAs(adminUserId, 'members.bulkRemove', [adminUserId, otherId])) as BulkRemoveResult;

    assert.strictEqual(result.removed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], new RegExp(adminUserId));
    assert.ok(await MembersCollection.findOneAsync(adminUserId), 'caller must survive a bulk delete that includes themselves');
    assert.strictEqual(await MembersCollection.findOneAsync(otherId), undefined);
  });

  it('reports missing ids as errors without aborting the batch', async () => {
    const existingId = await createTestUser();
    const missingId = `${TEST_PREFIX}missing_member`;

    const result = (await callAs(adminUserId, 'members.bulkRemove', [missingId, existingId])) as BulkRemoveResult;

    assert.strictEqual(result.removed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], new RegExp(missingId));
    assert.strictEqual(await MembersCollection.findOneAsync(existingId), undefined);
  });

  it('rejects an empty id list with 400', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'members.bulkRemove', []), 400);
  });

  it('rejects more than 100 ids with 400', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `${TEST_PREFIX}bulk_${i}`);
    await assertRejectsWithCode(() => callAs(adminUserId, 'members.bulkRemove', ids), 400);
  });

  it('rejects callers without members.delete permission with 403 and removes nothing', async () => {
    const targetId = await createTestUser();

    await assertRejectsWithCode(() => callAs(noDeleteUserId, 'members.bulkRemove', [targetId]), 403);

    assert.ok(await MembersCollection.findOneAsync(targetId), 'target must survive a denied bulk delete');
  });

  it('classifies per-id failures instead of forwarding the raw exception text', async () => {
    const pictureId = await createTestDoc(ProfilePicturesCollection, { value: 'data:image/png;base64,xxx' });
    const memberId = await createTestUser({ profile: { profilePictureId: pictureId } });
    const originalRemove = ProfilePicturesCollection.removeAsync.bind(ProfilePicturesCollection);
    (ProfilePicturesCollection as unknown as { removeAsync: unknown }).removeAsync = async () => {
      throw new Error('ECONNREFUSED mongodb://internal-host:27017 stack detail');
    };

    try {
      const result = (await callAs(adminUserId, 'members.bulkRemove', [memberId])) as BulkRemoveResult;

      assert.strictEqual(result.errors.length, 1);
      assert.match(result.errors[0], new RegExp(memberId));
      assert.ok(!result.errors[0].includes('ECONNREFUSED'), `per-id error leaked internal detail: ${result.errors[0]}`);
      assert.ok(!result.errors[0].includes('internal-host'), `per-id error leaked internal detail: ${result.errors[0]}`);
    } finally {
      (ProfilePicturesCollection as unknown as { removeAsync: typeof originalRemove }).removeAsync = originalRemove;
    }
  });
});

// A member delete has two phases: the member document itself, then the
// registry-driven cascade. Phase order decides what a partial failure leaves
// behind — a removed member with stale references (detectable by the orphan
// scan) or a detached member that survives with no audit entry at all.
describe('members.remove — partial-failure ordering (#384)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([ProfilePicturesCollection]);
  });

  it('keeps the member deleted and audited when the cascade fails, naming the phase', async () => {
    const pictureId = await createTestDoc(ProfilePicturesCollection, { value: 'data:image/png;base64,xxx' });
    const targetId = await createTestUser({ profile: { profilePictureId: pictureId } });
    const originalRemove = ProfilePicturesCollection.removeAsync.bind(ProfilePicturesCollection);
    (ProfilePicturesCollection as unknown as { removeAsync: unknown }).removeAsync = async () => {
      throw new Meteor.Error('cascade-boom', 'picture store offline');
    };

    try {
      await assert.rejects(
        () => callAs(adminUserId, 'members.remove', targetId),
        (error: unknown) => /cleanup/i.test((error as Meteor.Error).message),
        'error message must say which phase failed',
      );
      assert.strictEqual(await MembersCollection.findOneAsync(targetId), undefined, 'member must not survive detached');
      assert.ok(await findLatestAuditLog('members.deleted', targetId), 'the deletion must still be audited');
    } finally {
      (ProfilePicturesCollection as unknown as { removeAsync: typeof originalRemove }).removeAsync = originalRemove;
    }
  });
});

// Every member read path merges getSquadScope into its selector, and
// members.update refuses cross-squad writes. Deletes must refuse them too —
// bulkRemove would otherwise wipe up to 100 out-of-squad members in one call.
describe('members.remove / members.bulkRemove — squad scope (#384)', () => {
  let adminUserId: string;
  let scopedUserId: string;
  let sameSquadTargetId: string;
  let otherSquadTargetId: string;
  const scopedSquadId = `${TEST_PREFIX}squad_scoped`;
  const otherSquadId = `${TEST_PREFIX}squad_other`;

  before(async () => {
    const [adminRoleId, scopedRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ members: { read: true, create: true, update: true, delete: true } }),
    ]);
    [adminUserId, scopedUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: scopedRoleId, profile: { squadId: scopedSquadId } }),
    ]);
  });

  beforeEach(async () => {
    [sameSquadTargetId, otherSquadTargetId] = await Promise.all([
      createTestUser({ profile: { squadId: scopedSquadId } }),
      createTestUser({ profile: { squadId: otherSquadId } }),
    ]);
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('refuses members.remove for a member of another squad', async () => {
    await assertRejectsWithCode(() => callAs(scopedUserId, 'members.remove', otherSquadTargetId), 403);

    assert.ok(await MembersCollection.findOneAsync(otherSquadTargetId), 'out-of-squad member must survive');
  });

  it('allows members.remove within the caller squad', async () => {
    await callAs(scopedUserId, 'members.remove', sameSquadTargetId);

    assert.strictEqual(await MembersCollection.findOneAsync(sameSquadTargetId), undefined);
  });

  it('refuses out-of-squad ids in members.bulkRemove while removing in-squad ones', async () => {
    const result = (await callAs(scopedUserId, 'members.bulkRemove', [otherSquadTargetId, sameSquadTargetId])) as BulkRemoveResult;

    assert.strictEqual(result.removed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], new RegExp(otherSquadTargetId));
    assert.ok(await MembersCollection.findOneAsync(otherSquadTargetId), 'out-of-squad member must survive a bulk delete');
    assert.strictEqual(await MembersCollection.findOneAsync(sameSquadTargetId), undefined);
  });

  it('leaves an admin unscoped — deletes across squads', async () => {
    const result = (await callAs(adminUserId, 'members.bulkRemove', [otherSquadTargetId, sameSquadTargetId])) as BulkRemoveResult;

    assert.deepStrictEqual(result, { removed: 2, errors: [] });
    assert.strictEqual(await MembersCollection.findOneAsync(otherSquadTargetId), undefined);
    assert.strictEqual(await MembersCollection.findOneAsync(sameSquadTargetId), undefined);
  });
});
