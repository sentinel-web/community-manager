import assert from 'node:assert';
import {
  normalizeRolePermissions,
  isOfficerOrAdmin,
  BOOLEAN_MODULES,
} from '../../server/main';
import { COLLECTION_REGISTRY } from '../../server/collection-registry';
import type { CrudCollectionName, Role } from '/imports/api/types';

// Local derivation matching server/main.ts's CRUD_MODULE_SET. Used by
// normalizeRolePermissions tests that need the canonical CRUD-style
// permission-module list to drive role-shape assertions.
const CRUD_MODULE_SET: readonly string[] = [
  ...new Set(Object.values(COLLECTION_REGISTRY).map(entry => entry.module)),
].filter(module => !BOOLEAN_MODULES.includes(module));

describe('normalizeRolePermissions', () => {
  it('returns null for null input', () => {
    assert.strictEqual(normalizeRolePermissions(null), null);
  });

  it('returns null for undefined input', () => {
    assert.strictEqual(normalizeRolePermissions(undefined), null);
  });

  it('converts boolean true to full CRUD object', () => {
    const role: Role = { name: 'test', members: true };
    const result = normalizeRolePermissions(role);
    assert.ok(result);
    assert.deepStrictEqual(result.members, { read: true, create: true, update: true, delete: true });
  });

  it('converts boolean false to empty CRUD object', () => {
    const role: Role = { name: 'test', members: false };
    const result = normalizeRolePermissions(role);
    assert.ok(result);
    assert.deepStrictEqual(result.members, { read: false, create: false, update: false, delete: false });
  });

  it('converts undefined permission to empty CRUD object', () => {
    const role: Role = { name: 'test' };
    const result = normalizeRolePermissions(role);
    assert.ok(result);
    assert.deepStrictEqual(result.members, { read: false, create: false, update: false, delete: false });
  });

  it('preserves existing CRUD objects', () => {
    const crudObj = { read: true, create: false, update: true, delete: false };
    const role: Role = { name: 'test', members: crudObj };
    const result = normalizeRolePermissions(role);
    assert.ok(result);
    assert.deepStrictEqual(result.members, crudObj);
  });

  it('preserves admin flag (roles === true)', () => {
    const role: Role = { name: 'admin', roles: true, members: true };
    const result = normalizeRolePermissions(role);
    assert.ok(result);
    assert.strictEqual(result.roles, true);
  });

  it('does not modify boolean module permissions', () => {
    const role: Role = { name: 'test', dashboard: true, orbat: false, logs: true, settings: false };
    const result = normalizeRolePermissions(role);
    assert.ok(result);
    assert.strictEqual(result.dashboard, true);
    assert.strictEqual(result.orbat, false);
    assert.strictEqual(result.logs, true);
    assert.strictEqual(result.settings, false);
  });

  it('normalizes all CRUD modules', () => {
    const role = { name: 'full' } as Record<string, unknown>;
    for (const mod of CRUD_MODULE_SET) {
      role[mod] = true;
    }
    const result = normalizeRolePermissions(role as unknown as Role) as Record<string, unknown> | null;
    assert.ok(result);
    for (const mod of CRUD_MODULE_SET) {
      // 'roles' is special - it's the admin flag and gets restored
      if (mod === 'roles') continue;
      assert.deepStrictEqual(result[mod], { read: true, create: true, update: true, delete: true }, `${mod} should be normalized`);
    }
  });

  it('preserves non-permission fields', () => {
    const role: Role = { _id: '123', name: 'test', color: '#ff0000' };
    const result = normalizeRolePermissions(role);
    assert.ok(result);
    assert.strictEqual(result._id, '123');
    assert.strictEqual(result.name, 'test');
    assert.strictEqual(result.color, '#ff0000');
  });
});

describe('isOfficerOrAdmin', () => {
  it('returns false for null role', () => {
    assert.strictEqual(isOfficerOrAdmin(null), false);
  });

  it('returns false for undefined role', () => {
    assert.strictEqual(isOfficerOrAdmin(undefined), false);
  });

  it('returns false for non-admin role', () => {
    assert.strictEqual(isOfficerOrAdmin({ name: 'member', roles: false }), false);
  });

  it('returns false for role without roles property', () => {
    assert.strictEqual(isOfficerOrAdmin({ name: 'member' }), false);
  });

  it('returns true for admin role (roles === true)', () => {
    assert.strictEqual(isOfficerOrAdmin({ name: 'admin', roles: true }), true);
  });

  it('returns false for CRUD object roles permission', () => {
    assert.strictEqual(isOfficerOrAdmin({ name: 'editor', roles: { read: true, create: true, update: true, delete: true } }), false);
  });
});

describe('BOOLEAN_MODULES', () => {
  it('contains dashboard, orbat, logs, settings', () => {
    assert.deepStrictEqual([...BOOLEAN_MODULES].sort(), ['dashboard', 'logs', 'orbat', 'settings']);
  });
});

describe('COLLECTION_REGISTRY', () => {
  // Shape conformance: every member of the canonical CrudCollectionName union
  // has a registry entry. The Record<CrudCollectionName, _> type would already
  // enforce this at compile time; this test guards against the same omission
  // under loosened type checks (e.g. if anyone reaches for `as` casts).
  it('has an entry for every CrudCollectionName', () => {
    const expected: readonly CrudCollectionName[] = [
      'attendances',
      'discoveryTypes',
      'events',
      'eventTypes',
      'logs',
      'medals',
      'members',
      'positions',
      'profilePictures',
      'questionnaireResponses',
      'questionnaires',
      'ranks',
      'registrations',
      'roles',
      'specializations',
      'squads',
      'taskStatus',
      'tasks',
    ];
    for (const collection of expected) {
      assert.ok(COLLECTION_REGISTRY[collection], `Expected registry entry for ${collection}`);
      const { module } = COLLECTION_REGISTRY[collection];
      assert.strictEqual(typeof module, 'string');
      // Non-empty guardrail: an empty module string would be falsy at the
      // wrapper's `if (descriptor.permissionModule)` check, silently disabling
      // the permission gate for that collection.
      assert.ok(module.length > 0, `Registry entry for ${collection} must have a non-empty module`);
    }
    assert.deepStrictEqual([...Object.keys(COLLECTION_REGISTRY)].sort(), [...expected].sort());
  });

  it('maps overloaded collections to their permission module owner', () => {
    // attendances/profilePictures/questionnaireResponses do not have their
    // own permission modules — they ride on the parent module's permissions.
    assert.strictEqual(COLLECTION_REGISTRY.attendances.module, 'events');
    assert.strictEqual(COLLECTION_REGISTRY.profilePictures.module, 'members');
    assert.strictEqual(COLLECTION_REGISTRY.questionnaireResponses.module, 'questionnaires');
  });

  it('declares fallback flags only for collections that actually have them', () => {
    assert.strictEqual(COLLECTION_REGISTRY.events.fallback?.create, 'canCreateEvents');
    assert.strictEqual(COLLECTION_REGISTRY.tasks.fallback?.create, 'canManageTasks');
    assert.strictEqual(COLLECTION_REGISTRY.tasks.fallback?.update, 'canManageTasks');
    assert.strictEqual(COLLECTION_REGISTRY.medals.fallback, undefined);
  });

  it('declares allowsAnonymous only for registrations.insert', () => {
    assert.strictEqual(COLLECTION_REGISTRY.registrations.allowsAnonymous?.insert, true);
    assert.strictEqual(COLLECTION_REGISTRY.medals.allowsAnonymous, undefined);
  });

  it('does not declare any CRUD-style module that overlaps with BOOLEAN_MODULES', () => {
    for (const entry of Object.values(COLLECTION_REGISTRY)) {
      if (entry.module === 'logs') continue; // logs is intentionally a boolean module
      assert.ok(
        !BOOLEAN_MODULES.includes(entry.module),
        `Module ${entry.module} should not overlap with BOOLEAN_MODULES`,
      );
    }
  });
});
