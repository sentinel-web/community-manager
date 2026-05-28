import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import { assertSafeSelector } from '../../server/main';
import {
  assertRejectsWithCode,
  callAs,
  cleanupFixtures,
  createTestRole,
  createTestUser,
} from './fixtures';

// Read-side security hardening (#257/#258/#259/#262): a client-supplied selector
// must never carry a code-execution operator, read methods/publications must be
// permission-gated, and members.findOne must never leak the password hash.

describe('assertSafeSelector — rejects code-execution operators (#259)', () => {
  it('accepts a normal selector', () => {
    assert.doesNotThrow(() => assertSafeSelector({ 'profile.squadId': 'alpha', 'profile.id': { $gt: 5 } }));
  });

  it('rejects a top-level $where', () => {
    assert.throws(
      () => assertSafeSelector({ $where: 'this.profile.id > 0' }),
      (error: unknown) => (error as Meteor.Error).error === 400,
    );
  });

  it('rejects $expr', () => {
    assert.throws(
      () => assertSafeSelector({ $expr: { $gt: ['$a', '$b'] } }),
      (error: unknown) => (error as Meteor.Error).error === 400,
    );
  });

  it('rejects a nested $function inside $and', () => {
    assert.throws(
      () => assertSafeSelector({ $and: [{ name: 'x' }, { $function: { body: 'fn', args: [], lang: 'js' } }] }),
      (error: unknown) => (error as Meteor.Error).error === 400,
    );
  });

  it('rejects $accumulator', () => {
    assert.throws(
      () => assertSafeSelector({ total: { $accumulator: {} } }),
      (error: unknown) => (error as Meteor.Error).error === 400,
    );
  });

  it('rejects a non-object filter', () => {
    assert.throws(() => assertSafeSelector('not an object'));
  });
});

describe('members.findOne — authz + no password-hash leak (#257)', () => {
  let adminUserId: string;
  let noPermUserId: string;

  before(async () => {
    const [adminRoleId, noPermRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ members: { read: false, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, noPermUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: noPermRoleId }),
    ]);
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('denies a caller lacking members read permission — 403', async () => {
    await assertRejectsWithCode(() => callAs(noPermUserId, 'members.findOne', { _id: adminUserId }), 403);
  });

  it('rejects a $where selector — 400', async () => {
    await assertRejectsWithCode(
      () => callAs(adminUserId, 'members.findOne', { $where: 'true' }),
      400,
    );
  });

  it('never returns the services field even when the caller omits the projection', async () => {
    const result = (await callAs(adminUserId, 'members.findOne', { _id: adminUserId }, {})) as
      | Record<string, unknown>
      | undefined;
    assert.ok(result, 'Expected the admin user to be returned');
    assert.strictEqual(result.services, undefined, 'members.findOne must never expose services (password hash)');
  });

  it('still returns undefined on a miss (existence-check behavior preserved)', async () => {
    const result = await callAs(adminUserId, 'members.findOne', { 'profile.registrationId': 'nonexistent' });
    assert.strictEqual(result, undefined);
  });
});

describe('generic publication — authz gate (#258)', () => {
  let noPermUserId: string;

  before(async () => {
    const noPermRoleId = await createTestRole({
      registrations: { read: false, create: false, update: false, delete: false },
    });
    noPermUserId = await createTestUser({ roleId: noPermRoleId });
  });

  after(async () => {
    await cleanupFixtures();
  });

  // The publish handler resolves via this.userId + this.ready(); invoke it
  // directly with a synthetic subscription context (mirrors fixtures.callAs).
  function getPublishHandler(name: string) {
    const handlers = (Meteor as unknown as {
      server: { publish_handlers: Record<string, (this: { userId: string | null; ready: () => void; stop: () => void }, ...args: unknown[]) => unknown> };
    }).server.publish_handlers;
    const handler = handlers[name];
    assert.ok(handler, `Publication "${name}" must be registered`);
    return handler;
  }

  it('denies a member lacking registrations read permission — 403', async () => {
    const handler = getPublishHandler('registrations');
    const ctx = { userId: noPermUserId, ready: () => {}, stop: () => {} };
    await assertRejectsWithCode(() => Promise.resolve(handler.apply(ctx, [{}, {}])), 403);
  });
});
