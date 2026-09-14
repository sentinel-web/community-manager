import assert from 'node:assert';
import MembersCollection from '../../imports/api/collections/members.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import {
  assertRejectsWithCode,
  callAs,
  cleanupFixtures,
  createTestDoc,
  createTestRole,
  createTestUser,
  TEST_PREFIX,
} from './fixtures';

// A valid registration payload shared across the insert-validation specs.
function validRegistration(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: '__test_reg_valid',
    id: 1234,
    age: 18,
    rulesReadAndAccepted: true,
    ...overrides,
  };
}

describe('registrations.validateId / validateName — edit-path member-collision detection (#265)', () => {
  let editorUserId: string;
  // A member that "owns" an id/name a registration edit might collide with.
  const memberId = 4242;
  const memberName = '__test_member_collision';

  before(async () => {
    editorUserId = await createTestUser();
    // Member whose profile.id / profile.name we expect collisions against.
    await MembersCollection.insertAsync({
      _id: `${TEST_PREFIX}collision_member`,
      username: `${TEST_PREFIX}collision_member`,
      profile: { name: memberName, id: memberId },
    } as never);
  });

  after(async () => {
    await cleanupFixtures([MembersCollection, RegistrationsCollection]);
  });

  it('detects a member id collision on the EDIT path (excludeId set)', async () => {
    // Edit path: an existing registration is being edited (excludeId provided).
    // A member already holds this id, so the id is NOT available.
    const regId = await createTestDoc(RegistrationsCollection, validRegistration({ id: memberId }));
    const available = await callAs(editorUserId, 'registrations.validateId', memberId, regId);
    assert.strictEqual(available, false, 'Member id collision must be detected on edit path');
  });

  it('detects a member name collision on the EDIT path (excludeId set)', async () => {
    const regId = await createTestDoc(RegistrationsCollection, validRegistration({ name: memberName }));
    const available = await callAs(editorUserId, 'registrations.validateName', memberName, regId);
    assert.strictEqual(available, false, 'Member name collision must be detected on edit path');
  });

  it('still excludes the registration being edited from its own collision check', async () => {
    // Self-exclusion ({ _id: { $ne: excludeId } }) is retained: editing a
    // registration must not flag its own id/name as taken.
    const regId = await createTestDoc(RegistrationsCollection, validRegistration({ id: 5555, name: '__test_reg_self' }));
    const idAvailable = await callAs(editorUserId, 'registrations.validateId', 5555, regId);
    const nameAvailable = await callAs(editorUserId, 'registrations.validateName', '__test_reg_self', regId);
    assert.strictEqual(idAvailable, true, 'A registration must not collide with itself on id');
    assert.strictEqual(nameAvailable, true, 'A registration must not collide with itself on name');
  });

  it('reports a free id/name as available', async () => {
    const idAvailable = await callAs(editorUserId, 'registrations.validateId', 9001, false);
    const nameAvailable = await callAs(editorUserId, 'registrations.validateName', '__test_reg_unused', false);
    assert.strictEqual(idAvailable, true);
    assert.strictEqual(nameAvailable, true);
  });
});

describe('registrations.insert — server-side id-range & age validation (#260)', () => {
  // Registration insert is anonymous-friendly (allowsAnonymous.insert), so the
  // crafted-DDP threat model is an unauthenticated caller. We assert against
  // callAs(null, ...) to mirror that.
  after(async () => {
    await cleanupFixtures([RegistrationsCollection]);
  });

  it('accepts a valid registration (id in range, age >= 16)', async () => {
    const id = (await callAs(null, 'registrations.insert', validRegistration())) as string;
    assert.strictEqual(typeof id, 'string');
    const doc = await RegistrationsCollection.findOneAsync(id);
    assert.ok(doc, 'Valid registration must persist');
  });

  it('rejects id below 1000', async () => {
    await assertRejectsWithCode(() => callAs(null, 'registrations.insert', validRegistration({ id: 999 })), 'invalid-id');
  });

  it('rejects id above 9999', async () => {
    await assertRejectsWithCode(() => callAs(null, 'registrations.insert', validRegistration({ id: 10000 })), 'invalid-id');
  });

  it('rejects a non-integer id', async () => {
    await assertRejectsWithCode(() => callAs(null, 'registrations.insert', validRegistration({ id: 1234.5 })), 'invalid-id');
  });

  it('rejects age below 16', async () => {
    await assertRejectsWithCode(() => callAs(null, 'registrations.insert', validRegistration({ age: 15 })), 'invalid-age');
  });

  it('accepts the boundary values (id 1000, id 9999, age 16)', async () => {
    const low = (await callAs(null, 'registrations.insert', validRegistration({ id: 1000, name: '__test_reg_low' }))) as string;
    const high = (await callAs(null, 'registrations.insert', validRegistration({ id: 9999, name: '__test_reg_high' }))) as string;
    const minAge = (await callAs(null, 'registrations.insert', validRegistration({ id: 1500, name: '__test_reg_age', age: 16 }))) as string;
    assert.ok(low && high && minAge, 'Boundary values must be accepted');
  });

  it('does not leak an out-of-range document', async () => {
    await assertRejectsWithCode(
      () => callAs(null, 'registrations.insert', validRegistration({ id: 42, name: '__test_reg_leak' })),
      'invalid-id',
    );
    const leaked = await RegistrationsCollection.findOneAsync({ name: '__test_reg_leak' });
    assert.strictEqual(leaked, undefined, 'A rejected insert must not persist');
  });
});

describe('registrations createdAt — server-set submission timestamp (#377)', () => {
  const names = ['__test_reg_created', '__test_reg_spoofed', '__test_reg_update_spoof'];
  let editorUserId: string;

  before(async () => {
    const roleId = await createTestRole({ registrations: { read: true, create: true, update: true, delete: false } });
    editorUserId = await createTestUser({ roleId });
  });

  after(async () => {
    await RegistrationsCollection.removeAsync({ name: { $in: names } });
    await cleanupFixtures([RegistrationsCollection]);
  });

  it('stamps createdAt on insert', async () => {
    const before = Date.now();
    const id = (await callAs(null, 'registrations.insert', validRegistration({ id: 2001, name: names[0] }))) as string;
    const doc = await RegistrationsCollection.findOneAsync(id);
    assert.ok(doc?.createdAt instanceof Date, 'createdAt must be a server-set Date');
    assert.ok(doc.createdAt.getTime() >= before && doc.createdAt.getTime() <= Date.now(), 'createdAt must be the insert time');
  });

  it('ignores a client-supplied createdAt on insert', async () => {
    const spoofed = new Date('2000-01-01T00:00:00Z');
    const before = Date.now();
    const id = (await callAs(null, 'registrations.insert', validRegistration({ id: 2002, name: names[1], createdAt: spoofed }))) as string;
    const doc = await RegistrationsCollection.findOneAsync(id);
    assert.ok(doc?.createdAt instanceof Date);
    assert.ok(doc.createdAt.getTime() >= before, 'A client-supplied createdAt must be overwritten by the server');
  });

  it('does not let an update overwrite createdAt', async () => {
    const id = (await callAs(null, 'registrations.insert', validRegistration({ id: 2003, name: names[2] }))) as string;
    const original = (await RegistrationsCollection.findOneAsync(id))?.createdAt;
    await callAs(editorUserId, 'registrations.update', id, { description: 'edited', createdAt: new Date('2000-01-01T00:00:00Z') });
    const doc = await RegistrationsCollection.findOneAsync(id);
    assert.strictEqual(doc?.description, 'edited', 'The rest of the update must still apply');
    assert.deepStrictEqual(doc?.createdAt, original, 'createdAt must be immutable through update');
  });
});
