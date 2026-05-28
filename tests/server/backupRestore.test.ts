import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import {
  assertRejectsWithCode,
  callAs,
  cleanupFixtures,
  createTestRole,
  createTestUser,
  TEST_PREFIX,
} from './fixtures';

// SEC-004 regression suite. The vulnerability: backup.restore required only
// `settings` read access and inserted uploaded `users` documents verbatim, so
// a low-privilege user could upload a backup whose own user doc carried
// `roles: true` (or arbitrary `services`) and self-promote to admin.

interface BackupData {
  version: string;
  timestamp: string;
  appName: string;
  collections: Record<string, unknown[]>;
  meta: { totalDocuments: number; collectionCounts: Record<string, number> };
}

function makeBackup(collections: Record<string, unknown[]>): BackupData {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    appName: 'community-manager',
    collections,
    meta: { totalDocuments: 0, collectionCounts: {} },
  };
}

describe('backup.restore — SEC-004 privilege-escalation hardening', () => {
  let adminUserId: string;
  let settingsReaderUserId: string;

  before(async () => {
    const [adminRoleId, settingsRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      // `settings` is a boolean module: this grants the exact capability the
      // pre-SEC-004 restore required, and nothing more.
      createTestRole({ settings: true }),
    ]);
    [adminUserId, settingsReaderUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: settingsRoleId }),
    ]);
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('rejects unauthenticated callers with a not-authorized error', async () => {
    await assertRejectsWithCode(
      () => callAs(null, 'backup.restore', makeBackup({}), { createSafetyBackup: false }),
      'validateUserId',
    );
  });

  it('rejects a settings-only (non-admin) user with 403 — read access is no longer enough', async () => {
    await assertRejectsWithCode(
      () => callAs(settingsReaderUserId, 'backup.restore', makeBackup({}), { createSafetyBackup: false }),
      403,
    );
  });

  it('rejects a backup whose user doc carries roles: true (self-promotion) with 400', async () => {
    const malicious = makeBackup({
      users: [{ _id: `${TEST_PREFIX}attacker`, username: 'attacker', roles: true }],
    });

    await assertRejectsWithCode(
      () => callAs(adminUserId, 'backup.restore', malicious, { createSafetyBackup: false }),
      400,
    );

    // The malicious user must NOT have been inserted (fail-before-write).
    const leaked = await MembersCollection.findOneAsync(`${TEST_PREFIX}attacker`);
    assert.strictEqual(leaked, undefined, 'Rejected restore must not persist the attacker user doc');
  });

  it('rejects a backup whose user doc carries a services credential field with 400', async () => {
    const malicious = makeBackup({
      users: [{ _id: `${TEST_PREFIX}cred`, username: 'cred', services: { password: { bcrypt: 'x' } } }],
    });

    await assertRejectsWithCode(
      () => callAs(adminUserId, 'backup.restore', malicious, { createSafetyBackup: false }),
      400,
    );
  });

  it('rejects a backup whose user doc carries an unexpected top-level field with 400', async () => {
    const malicious = makeBackup({
      users: [{ _id: `${TEST_PREFIX}weird`, username: 'weird', isSuperAdmin: true }],
    });

    await assertRejectsWithCode(
      () => callAs(adminUserId, 'backup.restore', malicious, { createSafetyBackup: false }),
      400,
    );
  });

  it('rejects a backup smuggling roles via profile with 400', async () => {
    const malicious = makeBackup({
      users: [{ _id: `${TEST_PREFIX}sneaky`, username: 'sneaky', profile: { name: 'Sneaky', roles: true } }],
    });

    await assertRejectsWithCode(
      () => callAs(adminUserId, 'backup.restore', malicious, { createSafetyBackup: false }),
      400,
    );
  });

  it('rejects a malformed (non-array) collection payload with 400 before any wipe', async () => {
    const malformed = makeBackup({ users: { not: 'an array' } as unknown as unknown[] });

    await assertRejectsWithCode(
      () => callAs(adminUserId, 'backup.restore', malformed, { createSafetyBackup: false }),
      400,
    );

    // The admin fixture user is still present — nothing was wiped.
    const stillThere = await MembersCollection.findOneAsync(adminUserId);
    assert.ok(stillThere, 'Validation failure must leave the users collection untouched');
  });

  it('rejects a non-users collection doc with a missing _id with 400', async () => {
    const malformed = makeBackup({ roles: [{ name: 'no id role' }] });

    await assertRejectsWithCode(
      () => callAs(adminUserId, 'backup.restore', malformed, { createSafetyBackup: false }),
      400,
    );

    const leaked = await RolesCollection.findOneAsync({ name: 'no id role' });
    assert.strictEqual(leaked, undefined, 'Rejected restore must not persist a malformed role doc');
  });
});
