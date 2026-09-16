import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import {
  COLLECTION_PERMISSIONS,
  getModulePermissions,
  resolvePermissionTarget,
  type ModulePermissions,
} from '../../imports/api/permissions/modulePermissions';
import { COLLECTION_REGISTRY } from '../../server/collection-registry';
import { checkPermission, checkSpecialPermission, type CrudOperation } from '../../server/main';
import type { CrudCollectionName, Role } from '/imports/api/types';
import { callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

// Client-side module permissions (#357) must match what the server authorizes,
// including the registry's special-flag fallbacks (canCreateEvents, canManageTasks).

const NONE: ModulePermissions = { canRead: false, canCreate: false, canUpdate: false, canDelete: false };
const ALL: ModulePermissions = { canRead: true, canCreate: true, canUpdate: true, canDelete: true };

const PROBE_TARGET_NAME = '__test_probe_medal_target';
const PROBE_INSERT_NAME = '__test_probe_medal_inserted';

function permissionsFor(role: Role | undefined, collection: CrudCollectionName): ModulePermissions {
  const { module, fallback } = resolvePermissionTarget(collection);
  return getModulePermissions(role, module, fallback);
}

// Did the real method handler authorize the call? Only 401/403 counts as a
// denial; anything else (a validation or integrity error) means the probe
// itself is wrong and must not be silently read as "denied".
async function serverAllows(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    const code = (error as Meteor.Error).error;
    if (code === 401 || code === 403) return false;
    throw error;
  }
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
    // `logs` is a BOOLEAN module: checkPermission short-circuits on it, so a
    // stored CRUD object grants nothing while a bare `true` grants everything.
    // Both shapes are exercised here — this is the case the mirror used to get
    // wrong (it read `logs.read` and reported a permission the server denies).
    // The cast is the point: `Role.logs` is typed boolean, but nothing stops a
    // stored document (or a crafted write) from holding a CRUD object there.
    booleanModuleCrudShaped: {
      logs: { read: true, create: true, update: true, delete: true } as unknown as boolean,
      medals: { read: true },
    },
    booleanModuleTrue: { logs: true },
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
    await MedalsCollection.removeAsync({ name: { $in: [PROBE_INSERT_NAME, PROBE_TARGET_NAME] } });
    await cleanupFixtures([MedalsCollection]);
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

  // The loop above re-implements the server gate, so it can only catch a mirror
  // that disagrees with `checkPermission` — not one that disagrees with what the
  // methods actually do. These drive the real `medals.<op>` handlers end to end.
  // Medals is the plain-CRUD stand-in: no foreign keys, no custom overrides, so
  // the permission gate is the only thing that can reject the call.
  for (const label of Object.keys(ROLE_FIXTURES)) {
    it(`${label}: client permissions equal what the real medals.<op> handlers allow`, async () => {
      const { userId, role } = users[label];
      const client = permissionsFor(role, 'medals');
      // Probes run read → create → update → delete so the target still exists
      // for the middle two.
      const probeId = await createTestDoc(MedalsCollection, { name: PROBE_TARGET_NAME, color: '#ff0000' });
      const probes: { key: keyof ModulePermissions; op: string; run: () => Promise<unknown> }[] = [
        { key: 'canRead', op: 'read', run: () => callAs(userId, 'medals.read', { _id: probeId }) },
        { key: 'canCreate', op: 'insert', run: () => callAs(userId, 'medals.insert', { name: PROBE_INSERT_NAME }) },
        { key: 'canUpdate', op: 'update', run: () => callAs(userId, 'medals.update', probeId, { color: '#00ff00' }) },
        { key: 'canDelete', op: 'remove', run: () => callAs(userId, 'medals.remove', probeId) },
      ];

      for (const { key, op, run } of probes) {
        const allowed = await serverAllows(run);
        assert.strictEqual(client[key], allowed, `${label} medals.${op}: client=${client[key]} handler allowed=${allowed}`);
      }
    });
  }
});

// `permissionOverride` (server/mutation-pipeline.ts) re-admits a call the
// permission gate rejected, based on the payload being written. The client
// mirror is a pure function of the role, so it cannot express that — the
// divergence below is known and deliberate, and it errs toward hiding an
// affordance the server would in fact accept. Asserted rather than fixed so a
// future change to either side shows up here.
describe('known divergence: permissionOverride cannot be mirrored (members.update + canManageSpecializations)', () => {
  let instructorUserId: string;
  let targetMemberId: string;
  const instructorRole: Role = { name: 'Instructor', canManageSpecializations: true, members: { read: true } };

  before(async () => {
    const [instructorRoleId, plainRoleId] = await Promise.all([
      createTestRole({ canManageSpecializations: true, members: { read: true, create: false, update: false, delete: false } }),
      createTestRole({ members: { read: true } }),
    ]);
    [instructorUserId, targetMemberId] = await Promise.all([createTestUser({ roleId: instructorRoleId }), createTestUser({ roleId: plainRoleId })]);
  });

  after(async () => {
    await cleanupFixtures();
  });

  it('the mirror reports no update permission', () => {
    assert.strictEqual(permissionsFor(instructorRole, 'members').canUpdate, false);
  });

  it('but the real members.update handler accepts a specialization-only change', async () => {
    await callAs(instructorUserId, 'members.update', targetMemberId, { 'profile.specializationIds': [] });
    const stored = await MembersCollection.findOneAsync(targetMemberId);
    assert.deepStrictEqual(stored?.profile?.specializationIds, []);
  });

  it('and still refuses any other field, which is what the mirror is right about', async () => {
    const allowed = await serverAllows(() => callAs(instructorUserId, 'members.update', targetMemberId, { 'profile.name': 'Renamed' }));
    assert.strictEqual(allowed, false);
  });
});
