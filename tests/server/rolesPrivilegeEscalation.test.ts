import assert from 'node:assert';
import RolesCollection from '../../imports/api/collections/roles.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestRole, createTestUser, findLatestAuditLog } from './fixtures';
import type { Role } from '/imports/api/types';

// `roles: true` is the super-admin grant checkPermission short-circuits on, so
// holding `roles.create` / `roles.update` must not be enough to mint it — only
// a caller who is already an admin may set it. The client form's admin switch
// is a convenience, not the control: these tests drive the wire-level methods.

async function readRole(roleId: string): Promise<Role | undefined> {
  return (await RolesCollection.findOneAsync(roleId)) as Role | undefined;
}

describe('roles — only an admin may grant `roles: true`', () => {
  let adminUserId: string;
  let roleManagerUserId: string;
  let roleManagerRoleId: string;
  let targetRoleId: string;
  // Roles minted through `roles.insert` get a Random id outside the fixture
  // prefix, so they are tracked and removed explicitly.
  const insertedRoleIds: string[] = [];

  beforeEach(async () => {
    const [adminRoleId, managerRoleId, plainRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ roles: { read: true, create: true, update: true, delete: true } }),
      createTestRole({ name: 'Plain', members: { read: true } }),
    ]);
    roleManagerRoleId = managerRoleId;
    targetRoleId = plainRoleId;
    [adminUserId, roleManagerUserId] = await Promise.all([createTestUser({ roleId: adminRoleId }), createTestUser({ roleId: managerRoleId })]);
  });

  afterEach(async () => {
    await RolesCollection.removeAsync({ _id: { $in: insertedRoleIds } });
    insertedRoleIds.length = 0;
    await cleanupFixtures();
  });

  it('admin can grant the admin flag on update', async () => {
    await callAs(adminUserId, 'roles.update', targetRoleId, { roles: true });
    assert.strictEqual((await readRole(targetRoleId))?.roles, true);
  });

  it('admin can create a role that already carries the admin flag', async () => {
    const insertedId = (await callAs(adminUserId, 'roles.insert', { name: '__test_role_admin', roles: true })) as string;
    insertedRoleIds.push(insertedId);
    assert.strictEqual((await readRole(insertedId))?.roles, true);
  });

  it('a non-admin with roles.update cannot grant the admin flag — 403, document unchanged', async () => {
    await assertRejectsWithCode(() => callAs(roleManagerUserId, 'roles.update', targetRoleId, { roles: true }), 403);

    const stored = await readRole(targetRoleId);
    assert.notStrictEqual(stored?.roles, true, 'the admin grant must not be persisted');
    assert.strictEqual(stored?.name, 'Plain', 'the denied update must not write anything at all');
  });

  it('a non-admin cannot promote their own role to admin', async () => {
    await assertRejectsWithCode(() => callAs(roleManagerUserId, 'roles.update', roleManagerRoleId, { roles: true }), 403);
    assert.notStrictEqual((await readRole(roleManagerRoleId))?.roles, true);
  });

  it('a denied admin grant is audited like any other pre-body denial', async () => {
    await assertRejectsWithCode(() => callAs(roleManagerUserId, 'roles.update', targetRoleId, { roles: true }), 403);
    const log = await findLatestAuditLog('roles.update.denied', targetRoleId);
    assert.ok(log, 'Expected a roles.update.denied audit entry');
    assert.strictEqual(log.payload.userId, roleManagerUserId);
  });

  it('a non-admin with roles.create cannot insert a role carrying the admin flag — 403, nothing persisted', async () => {
    await assertRejectsWithCode(() => callAs(roleManagerUserId, 'roles.insert', { name: '__test_role_escalated', roles: true }), 403);
    assert.strictEqual(await RolesCollection.findOneAsync({ name: '__test_role_escalated' }), undefined);
  });

  it('a non-admin can still edit a role’s other fields', async () => {
    await callAs(roleManagerUserId, 'roles.update', targetRoleId, { name: 'Renamed', members: { read: true, update: true } });
    const stored = await readRole(targetRoleId);
    assert.strictEqual(stored?.name, 'Renamed');
    assert.deepStrictEqual(stored?.members, { read: true, update: true });
  });

  it('a non-admin can still insert an ordinary role', async () => {
    const insertedId = (await callAs(roleManagerUserId, 'roles.insert', {
      name: '__test_role_ordinary',
      roles: { read: true, create: false, update: false, delete: false },
    })) as string;
    insertedRoleIds.push(insertedId);
    assert.deepStrictEqual((await readRole(insertedId))?.roles, { read: true, create: false, update: false, delete: false });
  });
});
