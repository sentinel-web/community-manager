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
