import assert from 'node:assert';
import LogsCollection from '../../imports/api/collections/logs.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser, TEST_PREFIX } from './fixtures';

interface PaletteSearchResult {
  members: Array<{ _id: string }>;
  events: Array<{ _id: string }>;
  tasks: Array<{ _id: string }>;
  squads: Array<{ _id: string }>;
  registrations: Array<{ _id: string }>;
  questionnaires: Array<{ _id: string }>;
}

describe('palette.search', () => {
  let adminUserId: string;
  let memberOnlyUserId: string;
  let squadAUserId: string;
  let squadBUserId: string;
  let squadAId: string;
  let squadBId: string;
  let aliceId: string;
  let bobId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });

    const memberOnlyRoleId = await createTestRole({ members: { read: true, insert: false, update: false, delete: false } });
    memberOnlyUserId = await createTestUser({ roleId: memberOnlyRoleId });

    squadAId = await createTestDoc(SquadsCollection, { name: `${TEST_PREFIX}AlphaSquad` });
    squadBId = await createTestDoc(SquadsCollection, { name: `${TEST_PREFIX}BravoSquad` });

    const scopedRoleId = await createTestRole({ members: { read: true, insert: false, update: false, delete: false } });
    squadAUserId = await createTestUser({ roleId: scopedRoleId, profile: { squadId: squadAId } });
    squadBUserId = await createTestUser({ roleId: scopedRoleId, profile: { squadId: squadBId } });

    aliceId = await createTestUser({ profile: { name: `${TEST_PREFIX}AlicePal`, squadId: squadAId, id: 4242 } });
    bobId = await createTestUser({ profile: { name: `${TEST_PREFIX}BobPal`, squadId: squadBId, id: 4243 } });
  });

  after(async () => {
    await cleanupFixtures([SquadsCollection, EventsCollection]);
  });

  it('throws 401 when called without a userId', async () => {
    await assertRejectsWithCode(() => callAs(null, 'palette.search', 'AlicePal'), 401);
  });

  it('throws 400 for an empty query', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'palette.search', '   '), 400);
  });

  it('admin finds matching members by name', async () => {
    const result = (await callAs(adminUserId, 'palette.search', 'AlicePal')) as PaletteSearchResult;
    assert.ok(
      result.members.some(m => m._id === aliceId),
      'expected Alice in member results'
    );
  });

  it('admin finds matching members by numeric profile.id', async () => {
    const result = (await callAs(adminUserId, 'palette.search', '4242')) as PaletteSearchResult;
    assert.ok(
      result.members.some(m => m._id === aliceId),
      'expected Alice when searching by numeric id'
    );
  });

  it('returns empty arrays for collections the user cannot read', async () => {
    const result = (await callAs(memberOnlyUserId, 'palette.search', 'AlicePal')) as PaletteSearchResult;
    assert.deepStrictEqual(result.events, []);
    assert.deepStrictEqual(result.tasks, []);
    assert.deepStrictEqual(result.squads, []);
    assert.deepStrictEqual(result.registrations, []);
    assert.deepStrictEqual(result.questionnaires, []);
  });

  it('does not write a log entry for the search call', async () => {
    const before = await LogsCollection.find({ action: { $regex: '^palette\\.' } }).countAsync();
    await callAs(adminUserId, 'palette.search', 'AlicePal');
    const after = await LogsCollection.find({ action: { $regex: '^palette\\.' } }).countAsync();
    assert.strictEqual(before, after, 'palette.search must not write to the audit log');
  });

  it('squad-scoped officer searching across squads only sees their squad members', async () => {
    const fromA = (await callAs(squadAUserId, 'palette.search', 'BobPal')) as PaletteSearchResult;
    assert.strictEqual(
      fromA.members.find(m => m._id === bobId),
      undefined,
      'squad A user must not see squad B members'
    );

    const fromB = (await callAs(squadBUserId, 'palette.search', 'AlicePal')) as PaletteSearchResult;
    assert.strictEqual(
      fromB.members.find(m => m._id === aliceId),
      undefined,
      'squad B user must not see squad A members'
    );
  });

  it('squad-scoped officer can find members within their own squad', async () => {
    const fromA = (await callAs(squadAUserId, 'palette.search', 'AlicePal')) as PaletteSearchResult;
    assert.ok(
      fromA.members.some(m => m._id === aliceId),
      'squad A user expected to see squad A member'
    );
  });
});
