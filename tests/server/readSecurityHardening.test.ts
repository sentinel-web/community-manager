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

// A bcrypt-shaped services block mirroring what Accounts stores on a real
// member doc — present so the no-leak assertions are non-trivial (a user with
// no `services` would pass the assertion vacuously). The login-token hash is
// derived per user because Meteor.users carries a UNIQUE index on
// services.resume.loginTokens.hashedToken — a shared literal would collide
// (E11000) on the second fixture insert.
function fixtureServices(userId: string) {
  return {
    password: { bcrypt: '$2b$10$abcdefghijklmnopqrstuv' },
    resume: { loginTokens: [{ when: new Date(), hashedToken: `secrethashedtoken-${userId}` }] },
    // Reset tokens are equally sensitive — assert the whole block is gone.
    password_reset: { token: 'reset-secret', email: 'x@example.com', when: new Date() },
  };
}

// Writes a realistic `services` block onto a fixture user. createTestUser does
// not set one, so the strip assertions would otherwise pass vacuously.
async function attachServices(userId: string): Promise<void> {
  await Meteor.users.updateAsync({ _id: userId }, { $set: { services: fixtureServices(userId) } });
}

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
    await Promise.all([attachServices(adminUserId), attachServices(noPermUserId)]);
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

  it('never returns services when the caller explicitly requests fields:{services:1}', async () => {
    // An inclusion projection would normally make a `{ services: 0 }` merge
    // throw — the post-fetch strip is immune and still drops the block.
    const result = (await callAs(adminUserId, 'members.findOne', { _id: adminUserId }, { fields: { services: 1 } })) as
      | Record<string, unknown>
      | undefined;
    assert.ok(result, 'Expected the admin user to be returned');
    assert.strictEqual(result.services, undefined, 'members.findOne must strip services even when explicitly requested');
  });

  it('never returns services.password when the caller requests {"services.password":1}', async () => {
    const result = (await callAs(adminUserId, 'members.findOne', { _id: adminUserId }, { fields: { 'services.password': 1 } })) as
      | Record<string, unknown>
      | undefined;
    assert.ok(result, 'Expected the admin user to be returned');
    assert.strictEqual(result.services, undefined, 'members.findOne must strip the whole services block');
  });

  it('still returns undefined on a miss (existence-check behavior preserved)', async () => {
    const result = await callAs(adminUserId, 'members.findOne', { 'profile.registrationId': 'nonexistent' });
    assert.strictEqual(result, undefined);
  });
});

describe('members.read — never leaks the password hash (SEC-001)', () => {
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
    await Promise.all([attachServices(adminUserId), attachServices(noPermUserId)]);
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('denies a caller lacking members read permission — 403', async () => {
    await assertRejectsWithCode(() => callAs(noPermUserId, 'members.read', {}, {}), 403);
  });

  it('strips services even when the caller requests fields:{services:1}', async () => {
    const result = (await callAs(adminUserId, 'members.read', { _id: adminUserId }, { fields: { services: 1 } })) as
      | Record<string, unknown>[];
    assert.ok(Array.isArray(result) && result.length > 0, 'Expected at least the admin user');
    for (const member of result) {
      assert.strictEqual(member.services, undefined, 'members.read must never expose services (password hash)');
    }
  });

  it('strips services when the caller requests {"services.password":1}', async () => {
    const result = (await callAs(adminUserId, 'members.read', {}, { fields: { 'services.password': 1 } })) as
      | Record<string, unknown>[];
    assert.ok(Array.isArray(result) && result.length > 0, 'Expected members to be returned');
    for (const member of result) {
      assert.strictEqual(member.services, undefined, 'members.read must strip the whole services block');
    }
  });
});

describe('members.all — never leaks the password hash (SEC-001)', () => {
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
    await Promise.all([attachServices(adminUserId), attachServices(noPermUserId)]);
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('denies a caller lacking members read permission — 403', async () => {
    await assertRejectsWithCode(() => callAs(noPermUserId, 'members.all'), 403);
  });

  it('returns full member docs with the services block stripped', async () => {
    const result = (await callAs(adminUserId, 'members.all')) as Record<string, unknown>[];
    assert.ok(Array.isArray(result) && result.length > 0, 'Expected members to be returned');
    for (const member of result) {
      assert.strictEqual(member.services, undefined, 'members.all must never expose services (password hash)');
    }
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
