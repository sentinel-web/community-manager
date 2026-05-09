import assert from 'node:assert';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import LogsCollection from '../../imports/api/collections/logs.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import {
  assertRejectsWithCode,
  callAs,
  cleanupFixtures,
  createTestRole,
  createTestUser,
  TEST_PREFIX,
} from './fixtures';

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
