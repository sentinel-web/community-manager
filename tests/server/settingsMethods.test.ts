import assert from 'node:assert';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

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
});
