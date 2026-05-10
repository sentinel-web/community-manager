import { Meteor } from 'meteor/meteor';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestRole, createTestUser } from './fixtures';

describe('specializations.names — legacy try/catch removed (#97)', () => {
  let userId: string;

  before(async () => {
    const roleId = await createTestRole({});
    userId = await createTestUser({ roleId });
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('body error from SpecializationsCollection.find propagates with original Meteor.Error code intact', async () => {
    // Defends against the legacy `try { ... } catch (e) { throw new Meteor.Error(e.message) }`
    // wrapper sneaking back in — it would clobber the original error code into the
    // message position. Body errors must reach the caller untouched.
    const originalFind = SpecializationsCollection.find.bind(SpecializationsCollection);
    (SpecializationsCollection as unknown as { find: unknown }).find = () => {
      throw new Meteor.Error('test-spec-names-code', 'test-spec-names-message');
    };
    try {
      await assertRejectsWithCode(
        () => callAs(userId, 'specializations.names', []),
        'test-spec-names-code',
      );
    } finally {
      (SpecializationsCollection as unknown as { find: typeof originalFind }).find = originalFind;
    }
  });
});
