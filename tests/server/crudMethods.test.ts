import assert from 'node:assert';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import {
  assertRejectsWithCode,
  callAs,
  cleanupFixtures,
  createTestDoc,
  createTestRole,
  createTestUser,
  findLatestAuditLog,
  TEST_PREFIX,
} from './fixtures';
import type { Medal, SelectOption } from '/imports/api/types';

// Medals stands in for "plain CRUD collection with no side-effects" — findings
// here generalize to all 16 collections that share the crud.lib factory.

describe('crud.lib — medals happy path + permission enforcement', () => {
  let adminUserId: string;
  let readerUserId: string;
  let unauthorizedUserId: string;
  let insertedMedalId: string;

  before(async () => {
    const [adminRoleId, readerRoleId, noPermRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ medals: { read: true, create: false, update: false, delete: false } }),
      createTestRole({ medals: { read: false, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, readerUserId, unauthorizedUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: readerRoleId }),
      createTestUser({ roleId: noPermRoleId }),
    ]);
  });

  after(async () => {
    await cleanupFixtures([MedalsCollection]);
  });

  it('rejects unauthenticated calls with 401', async () => {
    await assertRejectsWithCode(() => callAs(null, 'medals.read', {}), 401);
  });

  it('admin can insert a document and receives a string id', async () => {
    insertedMedalId = (await callAs(adminUserId, 'medals.insert', {
      name: '__test_medal_alpha',
      color: '#ff0000',
    })) as string;
    assert.strictEqual(typeof insertedMedalId, 'string');
    assert.ok(insertedMedalId.length > 0);

    const doc = await MedalsCollection.findOneAsync(insertedMedalId);
    assert.ok(doc, 'Expected medal document to be persisted');
    assert.strictEqual(doc.name, '__test_medal_alpha');
  });

  it('insert writes an audit log entry', async () => {
    const log = await findLatestAuditLog('medals.created', insertedMedalId);
    assert.ok(log, 'Expected a medals.created log entry');
    assert.strictEqual(log.payload.name, '__test_medal_alpha');
  });

  it('non-privileged user cannot insert — 403', async () => {
    await assertRejectsWithCode(
      () => callAs(readerUserId, 'medals.insert', { name: '__test_medal_denied' }),
      403,
    );
    const leaked = await MedalsCollection.findOneAsync({ name: '__test_medal_denied' });
    assert.strictEqual(leaked, undefined, 'Denied insert must not persist a document');
  });

  it('reader can read but cannot update', async () => {
    const list = (await callAs(readerUserId, 'medals.read', { _id: insertedMedalId })) as Medal[];
    assert.strictEqual(list.length, 1);

    await assertRejectsWithCode(
      () => callAs(readerUserId, 'medals.update', insertedMedalId, { color: '#00ff00' }),
      403,
    );
  });

  it('admin can update and audit log captures the changes', async () => {
    await callAs(adminUserId, 'medals.update', insertedMedalId, { color: '#0000ff' });
    const doc = await MedalsCollection.findOneAsync(insertedMedalId);
    assert.ok(doc, 'Expected medal document after update');
    assert.strictEqual(doc.color, '#0000ff');

    const log = await findLatestAuditLog('medals.updated', insertedMedalId);
    assert.ok(log, 'Expected a medals.updated log entry');
    assert.deepStrictEqual(log.payload.changes, { color: '#0000ff' });
    // before-capture: the audit log records the touched field's pre-update
    // value, keyed identically to `changes`, enabling a before→after diff.
    assert.deepStrictEqual(log.payload.before, { color: '#ff0000' });
  });

  it('count respects permissions (reader allowed, unauthorized denied)', async () => {
    const readerCount = await callAs(readerUserId, 'medals.count', { _id: insertedMedalId });
    assert.strictEqual(readerCount, 1);

    await assertRejectsWithCode(() => callAs(unauthorizedUserId, 'medals.count', {}), 403);
  });

  it('options returns selectable {key,label,value} shape for reader', async () => {
    const options = (await callAs(readerUserId, 'medals.options', { _id: insertedMedalId })) as SelectOption<Medal>[];
    const [first, ...rest] = options;
    assert.strictEqual(rest.length, 0);
    assert.ok(first, 'Expected at least one option');
    assert.strictEqual(first.key, insertedMedalId);
    assert.strictEqual(first.value, insertedMedalId);
    assert.ok('label' in first && 'raw' in first);
  });

  it('unauthorized user cannot delete — 403', async () => {
    await assertRejectsWithCode(
      () => callAs(unauthorizedUserId, 'medals.remove', insertedMedalId),
      403,
    );
    const stillThere = await MedalsCollection.findOneAsync(insertedMedalId);
    assert.ok(stillThere, 'Denied delete must not remove the document');
  });

  it('admin can delete and audit log captures the deletion', async () => {
    // .remove now returns { id, effects } so the audit pipeline can attach
    // cascadeEffects when integrity primitives fire (#162). For collections
    // without foreign-key edges (medals has none today), `effects` is empty.
    const result = (await callAs(adminUserId, 'medals.remove', insertedMedalId)) as {
      id: string;
      effects: { pulled: Record<string, number>; setNull: Record<string, number>; cascaded: Record<string, number> };
    };
    assert.strictEqual(result.id, insertedMedalId);
    assert.deepStrictEqual(result.effects.pulled, {});
    assert.deepStrictEqual(result.effects.setNull, {});
    assert.deepStrictEqual(result.effects.cascaded, {});

    const gone = await MedalsCollection.findOneAsync(insertedMedalId);
    assert.strictEqual(gone, undefined);

    const log = await findLatestAuditLog('medals.deleted', insertedMedalId);
    assert.ok(log, 'Expected a medals.deleted log entry');
    assert.strictEqual(log.payload.id, insertedMedalId);
    // No edge produced an effect, so cascadeEffects must not appear in the audit payload.
    assert.strictEqual((log.payload as Record<string, unknown>).cascadeEffects, undefined);
  });

  it('delete of non-existent id throws 404', async () => {
    await assertRejectsWithCode(
      () => callAs(adminUserId, 'medals.remove', 'nonexistent_id_xyz'),
      404,
    );
  });

  it('bulkRemove rejects empty array with 400', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'medals.bulkRemove', []), 400);
  });

  it('bulkRemove caps at 100 ids with 400', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `${TEST_PREFIX}id_${i}`);
    await assertRejectsWithCode(() => callAs(adminUserId, 'medals.bulkRemove', ids), 400);
  });

  // validateObject throws Meteor.Error('validateRequiredObject', ...) before
  // crud.lib.ts can throw its own Meteor.Error(400, ...). The 400 throws in
  // crud.lib are therefore unreachable — tracked as follow-up.
  it('insert rejects non-object payload (validator-level)', async () => {
    await assertRejectsWithCode(
      () => callAs(adminUserId, 'medals.insert', 'not an object'),
      'validateRequiredObject',
    );
  });

  it('read rejects non-object filter (validator-level)', async () => {
    await assertRejectsWithCode(
      () => callAs(adminUserId, 'medals.read', 'not an object'),
      'validateRequiredObject',
    );
  });
});

describe('crud.lib — special permission fallback (events.canCreateEvents)', () => {
  let specialUserId: string;
  let weakUserId: string;

  before(async () => {
    const [specialRoleId, weakRoleId] = await Promise.all([
      createTestRole({
        events: { read: true, create: false, update: false, delete: false },
        canCreateEvents: true,
      }),
      createTestRole({ events: { read: true, create: false } }),
    ]);
    [specialUserId, weakUserId] = await Promise.all([
      createTestUser({ roleId: specialRoleId }),
      createTestUser({ roleId: weakRoleId }),
    ]);
  });

  after(async () => {
    await cleanupFixtures([EventsCollection]);
  });

  it('allows insert when fallback flag is set despite missing create permission', async () => {
    const eventId = (await callAs(specialUserId, 'events.insert', {
      name: 'Fallback-permitted event',
      start: new Date(),
      end: new Date(Date.now() + 3600 * 1000),
    })) as string;
    assert.ok(eventId, 'Expected event insert to succeed via canCreateEvents fallback');

    const doc = await EventsCollection.findOneAsync(eventId);
    assert.ok(doc, 'Event should be persisted');
  });

  it('denies insert when neither create permission nor fallback flag is set', async () => {
    await assertRejectsWithCode(
      () => callAs(weakUserId, 'events.insert', {
        name: 'should not persist',
        start: new Date(),
        end: new Date(),
      }),
      403,
    );
  });
});

describe('crud.lib — role cache invalidates on roles.update / roles.remove', () => {
  // Guard against silent-permission bugs: a user whose role is downgraded or
  // deleted must lose access on the very next call, not ride a cached role.
  let demotableUserId: string;
  let demotableRoleId: string;
  let adminUserId: string;

  before(async () => {
    const [adminRoleId, roleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ medals: { read: true, create: false, update: false, delete: false } }),
    ]);
    demotableRoleId = roleId;
    [adminUserId, demotableUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: demotableRoleId }),
    ]);
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('user can read before role update', async () => {
    const result = await callAs(demotableUserId, 'medals.read', {});
    assert.ok(Array.isArray(result));
  });

  it('roles.update clears cache — revoked read returns 403 on next call', async () => {
    await callAs(adminUserId, 'roles.update', demotableRoleId, {
      medals: { read: false, create: false, update: false, delete: false },
    });

    await assertRejectsWithCode(() => callAs(demotableUserId, 'medals.read', {}), 403);
  });

  it('roles.remove clears cache — user without role has no permission', async () => {
    // The members.profile.roleId → roles edge is `block` (PRD policy), so
    // deleting a role that's still held throws foreign_key_blocked. Detach
    // the user first via direct Mongo update (bypasses Members write
    // validation so the test stays focused on the cache-invalidation
    // invariant rather than the role-reassignment UX).
    await MembersCollection.updateAsync(demotableUserId, { $unset: { 'profile.roleId': '' } });
    await callAs(adminUserId, 'roles.remove', demotableRoleId);

    await assertRejectsWithCode(() => callAs(demotableUserId, 'medals.read', {}), 403);
  });
});

describe('crud.lib — createTestDoc fixture', () => {
  after(async () => {
    await cleanupFixtures([MedalsCollection]);
  });

  it('inserts a document with test-prefixed _id that cleanupFixtures removes', async () => {
    const id = await createTestDoc(MedalsCollection, { name: '__test_fixture_medal' });
    assert.ok(id.startsWith(TEST_PREFIX));

    const present = await MedalsCollection.findOneAsync(id);
    assert.ok(present);

    await cleanupFixtures([MedalsCollection]);
    const gone = await MedalsCollection.findOneAsync(id);
    assert.strictEqual(gone, undefined);
  });
});
