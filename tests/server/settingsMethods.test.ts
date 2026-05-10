import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

describe('settings.findOne — returns undefined on miss (#131)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ settings: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([SettingsCollection]);
  });

  it('returns undefined when no setting matches the key (no throw)', async () => {
    // Regression: previously threw Meteor.Error(404, 'Setting not found') on miss.
    // The `settings.findOne` method had no live caller, but the throw-on-miss +
    // try/catch wrapper that collapsed body errors into messages was the same
    // antipattern PR #129 fixed for `members.findOne` (see PRD #97 user story 7).
    const result = await callAs(adminUserId, 'settings.findOne', 'nonexistent-key');
    assert.strictEqual(result, undefined);
  });

  it('returns the stored value when a setting matches the key', async () => {
    const stored = { foo: 'bar' };
    await createTestDoc(SettingsCollection, { key: 'community-probe', value: stored });
    const result = await callAs(adminUserId, 'settings.findOne', 'community-probe');
    assert.deepStrictEqual(result, stored);
  });

  it('body error from SettingsCollection.findOneAsync propagates with original Meteor.Error code intact', async () => {
    // Targets the legacy `try { ... } catch (e) { throw new Meteor.Error(e.message) }`
    // wrapper that this PR removed — the antipattern collapsed the original error
    // code into the message position. Mirrors the pattern in membersMethods.test.ts.
    const originalFindOne = SettingsCollection.findOneAsync.bind(SettingsCollection);
    (SettingsCollection as unknown as { findOneAsync: unknown }).findOneAsync = async () => {
      throw new Meteor.Error('test-findone-code', 'test-findone-message');
    };
    try {
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'settings.findOne', 'any-key'),
        'test-findone-code',
      );
    } finally {
      (SettingsCollection as unknown as { findOneAsync: typeof originalFindOne }).findOneAsync = originalFindOne;
    }
  });
});

describe('settings.upsert — drops legacy try/catch + nullish-only value check (#133)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ settings: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([SettingsCollection]);
  });

  it('inserts a new setting on first call and updates it on subsequent calls (round-trip via findOne)', async () => {
    await callAs(adminUserId, 'settings.upsert', 'community-probe-upsert', 'first');
    assert.strictEqual(await callAs(adminUserId, 'settings.findOne', 'community-probe-upsert'), 'first');
    await callAs(adminUserId, 'settings.upsert', 'community-probe-upsert', 'second');
    assert.strictEqual(await callAs(adminUserId, 'settings.findOne', 'community-probe-upsert'), 'second');
  });

  it('accepts 0, false, and empty string as legitimate setting values', async () => {
    // Settings values can legitimately be 0, false, or '' — only nullish is invalid.
    for (const value of [0, false, '']) {
      await callAs(adminUserId, 'settings.upsert', 'community-probe-falsy', value);
      assert.strictEqual(await callAs(adminUserId, 'settings.findOne', 'community-probe-falsy'), value);
    }
  });

  it('rejects null and undefined with the invalid-value error code', async () => {
    await assertRejectsWithCode(
      () => callAs(adminUserId, 'settings.upsert', 'community-probe-null', null),
      'invalid-value',
    );
    await assertRejectsWithCode(
      () => callAs(adminUserId, 'settings.upsert', 'community-probe-undef', undefined),
      'invalid-value',
    );
  });

  it('body error from SettingsCollection.upsertAsync propagates with original Meteor.Error code intact', async () => {
    const originalUpsert = SettingsCollection.upsertAsync.bind(SettingsCollection);
    (SettingsCollection as unknown as { upsertAsync: unknown }).upsertAsync = async () => {
      throw new Meteor.Error('test-upsert-code', 'test-upsert-message');
    };
    try {
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'settings.upsert', 'community-probe-throws', 'any'),
        'test-upsert-code',
      );
    } finally {
      (SettingsCollection as unknown as { upsertAsync: typeof originalUpsert }).upsertAsync = originalUpsert;
    }
  });
});

describe('settings.remove — drops legacy try/catch + uses { key } selector (#133)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ settings: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([SettingsCollection]);
  });

  it('removes a setting matched by key field (not _id), so subsequent findOne returns undefined', async () => {
    // Pre-PR the method called removeAsync(key) which only matched by _id.
    // Insert a doc whose _id and key differ to prove the new { key } selector
    // is doing the work — the old _id-based form would not have found this.
    await createTestDoc(SettingsCollection, { key: 'community-probe-remove', value: 'doomed' });
    assert.strictEqual(await callAs(adminUserId, 'settings.findOne', 'community-probe-remove'), 'doomed');
    await callAs(adminUserId, 'settings.remove', 'community-probe-remove');
    assert.strictEqual(await callAs(adminUserId, 'settings.findOne', 'community-probe-remove'), undefined);
  });

  it('body error from SettingsCollection.removeAsync propagates with original Meteor.Error code intact', async () => {
    const originalRemove = SettingsCollection.removeAsync.bind(SettingsCollection);
    (SettingsCollection as unknown as { removeAsync: unknown }).removeAsync = async () => {
      throw new Meteor.Error('test-remove-code', 'test-remove-message');
    };
    try {
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'settings.remove', 'any-key'),
        'test-remove-code',
      );
    } finally {
      (SettingsCollection as unknown as { removeAsync: typeof originalRemove }).removeAsync = originalRemove;
    }
  });
});
