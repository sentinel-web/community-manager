import assert from 'node:assert';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

const NAME = '__test_field_validation';

describe('squads.order / ranks.abbreviation write validation (#369, #373)', () => {
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await Promise.all([SquadsCollection.removeAsync({ name: NAME }), RanksCollection.removeAsync({ name: NAME })]);
    await cleanupFixtures([RanksCollection, SquadsCollection]);
  });

  describe('squads.order', () => {
    it('accepts a non-negative number, null, or no order on insert', async () => {
      for (const order of [0, 3, 2.5, null, undefined]) {
        const squadId = await callAs(adminUserId, 'squads.insert', { name: NAME, order });
        assert.ok(await SquadsCollection.findOneAsync(squadId as string), `order ${String(order)} must be accepted`);
      }
    });

    it('rejects a non-numeric order on insert', async () => {
      await assertRejectsWithCode(() => callAs(adminUserId, 'squads.insert', { name: NAME, order: '1' }), 'invalid-order');
    });

    it('rejects a negative or non-finite order on insert', async () => {
      await assertRejectsWithCode(() => callAs(adminUserId, 'squads.insert', { name: NAME, order: -1 }), 'invalid-order');
      await assertRejectsWithCode(() => callAs(adminUserId, 'squads.insert', { name: NAME, order: Number.NaN }), 'invalid-order');
      await assertRejectsWithCode(() => callAs(adminUserId, 'squads.insert', { name: NAME, order: Infinity }), 'invalid-order');
    });

    it('rejects an invalid order on update and keeps the stored value', async () => {
      const squadId = await createTestDoc(SquadsCollection, { name: NAME, order: 1 });
      await assertRejectsWithCode(() => callAs(adminUserId, 'squads.update', squadId, { order: 'first' }), 'invalid-order');
      const stored = await SquadsCollection.findOneAsync(squadId);
      assert.strictEqual(stored?.order, 1);
    });

    it('accepts a valid order on update', async () => {
      const squadId = await createTestDoc(SquadsCollection, { name: NAME });
      await callAs(adminUserId, 'squads.update', squadId, { order: 4 });
      const stored = await SquadsCollection.findOneAsync(squadId);
      assert.strictEqual(stored?.order, 4);
    });
  });

  describe('ranks.abbreviation', () => {
    it('accepts a short string, empty string, null, or no abbreviation on insert', async () => {
      for (const abbreviation of ['OFw', '', null, undefined]) {
        const rankId = await callAs(adminUserId, 'ranks.insert', { name: NAME, type: 'player', abbreviation });
        assert.ok(await RanksCollection.findOneAsync(rankId as string), `abbreviation ${String(abbreviation)} must be accepted`);
      }
    });

    it('rejects a non-string abbreviation on insert', async () => {
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'ranks.insert', { name: NAME, type: 'player', abbreviation: 42 }),
        'invalid-abbreviation'
      );
    });

    it('rejects an abbreviation longer than 16 characters', async () => {
      await callAs(adminUserId, 'ranks.insert', { name: NAME, type: 'player', abbreviation: 'x'.repeat(16) });
      await assertRejectsWithCode(
        () => callAs(adminUserId, 'ranks.insert', { name: NAME, type: 'player', abbreviation: 'x'.repeat(17) }),
        'invalid-abbreviation'
      );
    });

    it('rejects an invalid abbreviation on update and keeps the stored value', async () => {
      const rankId = await createTestDoc(RanksCollection, { name: NAME, type: 'player', abbreviation: 'Sgt' });
      await assertRejectsWithCode(() => callAs(adminUserId, 'ranks.update', rankId, { abbreviation: { $gt: '' } }), 'invalid-abbreviation');
      const stored = await RanksCollection.findOneAsync(rankId);
      assert.strictEqual(stored?.abbreviation, 'Sgt');
    });
  });
});
