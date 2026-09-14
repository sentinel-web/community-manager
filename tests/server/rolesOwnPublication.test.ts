import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import type { Role } from '/imports/api/types';
import { assertRejectsWithCode, cleanupFixtures, createTestRole, createTestUser } from './fixtures';

// `roles.own` (#355): every authenticated user can read exactly their own role
// document, independent of `roles.read` — and nothing else.

interface PublishContext {
  userId: string | null;
  ready: () => void;
  stop: () => void;
}

type PublishHandler = (this: PublishContext, ...args: unknown[]) => unknown;

function getPublishHandler(name: string): PublishHandler {
  const handlers = (Meteor as unknown as { server: { publish_handlers: Record<string, PublishHandler> } }).server.publish_handlers;
  const handler = handlers[name];
  assert.ok(handler, `Publication "${name}" must be registered`);
  return handler;
}

interface PublishOutcome {
  docs: Role[];
  readyCalled: boolean;
}

async function subscribeAs(name: string, userId: string | null, ...args: unknown[]): Promise<PublishOutcome> {
  let readyCalled = false;
  const ctx: PublishContext = { userId, ready: () => (readyCalled = true), stop: () => {} };
  const result = (await getPublishHandler(name).apply(ctx, args)) as Mongo.Cursor<Role> | undefined;
  const docs = result && typeof result.fetchAsync === 'function' ? await result.fetchAsync() : [];
  return { docs, readyCalled };
}

describe('roles.own publication (#355)', () => {
  let memberRoleId: string;
  let otherRoleId: string;
  let memberUserId: string;
  let roleLessUserId: string;

  before(async () => {
    [memberRoleId, otherRoleId] = await Promise.all([
      createTestRole({ roles: { read: false, create: false, update: false, delete: false }, events: { read: true } }),
      createTestRole({ roles: true }),
    ]);
    [memberUserId, roleLessUserId] = await Promise.all([createTestUser({ roleId: memberRoleId }), createTestUser()]);
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('publishes the caller’s own role even without roles.read', async () => {
    const { docs } = await subscribeAs('roles.own', memberUserId);
    assert.deepStrictEqual(
      docs.map(doc => doc._id),
      [memberRoleId]
    );
  });

  it('still publishes the caller’s own role when the (untrusted) hint names another role', async () => {
    const { docs } = await subscribeAs('roles.own', memberUserId, otherRoleId);
    assert.deepStrictEqual(
      docs.map(doc => doc._id),
      [memberRoleId],
      'the hint must never select which role is published'
    );
  });

  it('publishes nothing for an anonymous caller', async () => {
    const { docs, readyCalled } = await subscribeAs('roles.own', null, otherRoleId);
    assert.deepStrictEqual(docs, []);
    assert.strictEqual(readyCalled, true);
  });

  it('publishes nothing for a user without an assigned role', async () => {
    const { docs, readyCalled } = await subscribeAs('roles.own', roleLessUserId, otherRoleId);
    assert.deepStrictEqual(docs, []);
    assert.strictEqual(readyCalled, true);
  });

  it('rejects a non-string hint (e.g. a selector object)', async () => {
    await assert.rejects(() => subscribeAs('roles.own', memberUserId, { _id: { $ne: null } }));
  });

  it('leaves the generic roles publication gated on roles.read — 403', async () => {
    await assertRejectsWithCode(() => subscribeAs('roles', memberUserId, { _id: memberRoleId }, {}), 403);
  });
});
