import assert from 'node:assert';
import {
  COLLECTION_PERMISSIONS,
  getModulePermissions,
  resolvePermissionTarget,
  type ModulePermissions,
} from '../../imports/api/permissions/modulePermissions';
import { COLLECTION_REGISTRY } from '../../server/collection-registry';
import { checkPermission, checkSpecialPermission, type CrudOperation } from '../../server/main';
import type { CrudCollectionName, Role } from '/imports/api/types';
import { cleanupFixtures, createTestRole, createTestUser } from './fixtures';

// Client-side module permissions (#357) must match what the server authorizes,
// including the registry's special-flag fallbacks (canCreateEvents, canManageTasks).

const NONE: ModulePermissions = { canRead: false, canCreate: false, canUpdate: false, canDelete: false };
const ALL: ModulePermissions = { canRead: true, canCreate: true, canUpdate: true, canDelete: true };

function permissionsFor(role: Role | undefined, collection: CrudCollectionName): ModulePermissions {
  const { module, fallback } = resolvePermissionTarget(collection);
  return getModulePermissions(role, module, fallback);
}

describe('COLLECTION_PERMISSIONS mirrors COLLECTION_REGISTRY', () => {
  it('has exactly the registry’s collections', () => {
    assert.deepStrictEqual(Object.keys(COLLECTION_PERMISSIONS).sort(), Object.keys(COLLECTION_REGISTRY).sort());
  });

  for (const collection of Object.keys(COLLECTION_REGISTRY) as CrudCollectionName[]) {
    it(`${collection}: same module and fallback as the server registry`, () => {
      const server = COLLECTION_REGISTRY[collection];
      const client = COLLECTION_PERMISSIONS[collection];
      assert.strictEqual(client.module, server.module);
      assert.deepStrictEqual(client.fallback, server.fallback);
    });
  }
});

describe('getModulePermissions', () => {
  it('grants nothing without a role', () => {
    assert.deepStrictEqual(permissionsFor(undefined, 'members'), NONE);
  });

  it('grants everything to an admin role (roles: true)', () => {
    assert.deepStrictEqual(permissionsFor({ name: 'Admin', roles: true }, 'members'), ALL);
  });

  it('expands a legacy boolean module grant to full CRUD', () => {
    assert.deepStrictEqual(permissionsFor({ name: 'Legacy', members: true }, 'members'), ALL);
  });

  it('maps a CRUD object per operation', () => {
    const role: Role = { name: 'Partial', members: { read: true, update: true } };
    assert.deepStrictEqual(permissionsFor(role, 'members'), { canRead: true, canCreate: false, canUpdate: true, canDelete: false });
  });

  it('honours canCreateEvents for event creation only', () => {
    const role: Role = { name: 'Zeus', canCreateEvents: true };
    assert.deepStrictEqual(permissionsFor(role, 'events'), { ...NONE, canCreate: true });
  });

  it('honours canManageTasks for task creation and update only', () => {
    const role: Role = { name: 'Developer', canManageTasks: true };
    assert.deepStrictEqual(permissionsFor(role, 'tasks'), { ...NONE, canCreate: true, canUpdate: true });
  });

  it('does not apply a fallback flag to collections that do not declare it', () => {
    const role: Role = { name: 'Zeus', canCreateEvents: true, canManageTasks: true };
    assert.deepStrictEqual(permissionsFor(role, 'medals'), NONE);
    assert.deepStrictEqual(permissionsFor(role, 'attendances'), NONE);
  });

  it('resolves overloaded collections to their owning module', () => {
    assert.strictEqual(resolvePermissionTarget('attendances').module, 'events');
    assert.strictEqual(resolvePermissionTarget('profilePictures').module, 'members');
    assert.strictEqual(resolvePermissionTarget('notACollection').module, 'notACollection');
    assert.strictEqual(resolvePermissionTarget('members', 'squads').module, 'squads');
  });
});

describe('CollectionSelect inline action gating (#356)', () => {
  // Every `subscription` a CollectionSelect is mounted with today.
  const SUBSCRIPTIONS: CrudCollectionName[] = [
    'discoveryTypes',
    'eventTypes',
    'medals',
    'members',
    'positions',
    'ranks',
    'roles',
    'specializations',
    'squads',
    'taskStatus',
    'tasks',
  ];

  for (const subscription of SUBSCRIPTIONS) {
    it(`${subscription}: a read-only role gets no create/edit/delete, and each grant enables only its button`, () => {
      const { module } = resolvePermissionTarget(subscription);
      assert.strictEqual(module, COLLECTION_REGISTRY[subscription].module);
      const readOnly = { name: 'Reader', [module]: { read: true } } as Role;
      assert.deepStrictEqual(permissionsFor(readOnly, subscription), { ...NONE, canRead: true });
      const creator = { name: 'Creator', [module]: { create: true } } as Role;
      assert.deepStrictEqual(permissionsFor(creator, subscription), { ...NONE, canCreate: true });
      const deleter = { name: 'Deleter', [module]: { delete: true } } as Role;
      assert.deepStrictEqual(permissionsFor(deleter, subscription), { ...NONE, canDelete: true });
    });
  }
});

describe('getModulePermissions agrees with server authorization', () => {
  const OPERATIONS: { op: CrudOperation; key: keyof ModulePermissions }[] = [
    { op: 'read', key: 'canRead' },
    { op: 'create', key: 'canCreate' },
    { op: 'update', key: 'canUpdate' },
    { op: 'delete', key: 'canDelete' },
  ];

  const ROLE_FIXTURES: Record<string, Partial<Role>> = {
    admin: { roles: true },
    developer: { canManageTasks: true, tasks: { read: true } },
    legacy: { members: true, events: false },
    member: { events: { read: true }, roles: { read: false, create: false, update: false, delete: false } },
    zeus: { canCreateEvents: true, events: { read: true, update: true } },
  };

  const users: Record<string, { userId: string; role: Role }> = {};

  before(async () => {
    for (const [label, permissions] of Object.entries(ROLE_FIXTURES)) {
      const roleId = await createTestRole(permissions);
      const userId = await createTestUser({ roleId });
      users[label] = { userId, role: { name: label, ...permissions } };
    }
  });

  after(async () => {
    await cleanupFixtures();
  });

  for (const label of Object.keys(ROLE_FIXTURES)) {
    it(`${label}: client permissions equal server decisions for every collection and operation`, async () => {
      const { userId, role } = users[label];
      for (const collection of Object.keys(COLLECTION_REGISTRY) as CrudCollectionName[]) {
        const { module, fallback } = COLLECTION_REGISTRY[collection];
        const client = permissionsFor(role, collection);
        for (const { op, key } of OPERATIONS) {
          const flag = op === 'create' ? fallback?.create : op === 'update' ? fallback?.update : undefined;
          const server = (await checkPermission(userId, module, op)) || (flag ? await checkSpecialPermission(userId, flag) : false);
          assert.strictEqual(client[key], server, `${label} ${collection}.${op}: client=${client[key]} server=${server}`);
        }
      }
    });
  }
});
