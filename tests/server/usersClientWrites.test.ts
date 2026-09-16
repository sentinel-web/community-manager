import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { assertRejectsWithCode, cleanupFixtures, createTestRole, createTestUser } from './fixtures';

// User documents are only ever mutated through server methods. The collection
// mutation methods Meteor registers for Meteor.users (`/users/<op>`) must
// reject every client call, including a user editing their own `profile`,
// which accounts-base allows by default.

type MutationHandler = (this: { userId: string | null; isSimulation: boolean }, ...args: unknown[]) => unknown;

function getMutationHandler(name: string): MutationHandler {
  const handlers = (Meteor as unknown as { server: { method_handlers: Record<string, MutationHandler> } }).server.method_handlers;
  const handler = handlers[name];
  assert.ok(handler, `Method "${name}" must be registered`);
  return handler;
}

function callAsClient(userId: string | null, name: string, ...args: unknown[]): Promise<unknown> {
  return Promise.resolve().then(() => getMutationHandler(name).apply({ userId, isSimulation: false }, args));
}

describe('Meteor.users — client-side writes are denied', () => {
  let userId: string;
  let ownRoleId: string;
  let adminRoleId: string;

  before(async () => {
    [ownRoleId, adminRoleId] = await Promise.all([createTestRole({ events: { read: true } }), createTestRole({ roles: true })]);
    userId = await createTestUser({ roleId: ownRoleId });
  });

  after(async () => {
    await cleanupFixtures();
  });

  for (const op of ['update', 'updateAsync']) {
    it(`/users/${op}: rejects a user setting their own profile.roleId — 403`, async () => {
      await assertRejectsWithCode(() => callAsClient(userId, `/users/${op}`, { _id: userId }, { $set: { 'profile.roleId': adminRoleId } }), 403);
      const stored = await Meteor.users.findOneAsync(userId);
      assert.strictEqual(stored?.profile?.roleId, ownRoleId, 'roleId must be unchanged');
    });

    it(`/users/${op}: rejects a user replacing their own profile object — 403`, async () => {
      await assertRejectsWithCode(
        () => callAsClient(userId, `/users/${op}`, { _id: userId }, { $set: { profile: { name: 'x', roleId: adminRoleId } } }),
        403
      );
      const stored = await Meteor.users.findOneAsync(userId);
      assert.strictEqual(stored?.profile?.roleId, ownRoleId, 'roleId must be unchanged');
    });
  }

  // Characterization, not regression guards for the deny rule: Meteor rejects
  // client inserts and removes on Meteor.users by default (no `insecure`, no
  // allow rule), so these would pass with the deny rule removed. They are here
  // to pin that default down — only the `update` cases above actually exercise
  // it, since accounts-base otherwise lets a user write their own profile.
  for (const op of ['insert', 'insertAsync']) {
    it(`/users/${op}: rejects a client insert — 403`, async () => {
      await assertRejectsWithCode(
        () => callAsClient(userId, `/users/${op}`, { username: `test_client_${op}`, profile: { roleId: adminRoleId } }),
        403
      );
      assert.strictEqual(await Meteor.users.findOneAsync({ username: `test_client_${op}` }), undefined);
    });
  }

  for (const op of ['remove', 'removeAsync']) {
    it(`/users/${op}: rejects a user removing their own document — 403`, async () => {
      await assertRejectsWithCode(() => callAsClient(userId, `/users/${op}`, { _id: userId }), 403);
      assert.ok(await Meteor.users.findOneAsync(userId), 'user document must still exist');
    });
  }
});
