/* global describe, it */
import assert from 'node:assert';
import {
  normalizeRolePermissions,
  isOfficerOrAdmin,
  getPermissionModule,
  BOOLEAN_MODULES,
  CRUD_MODULES,
} from '../../server/main';

describe('normalizeRolePermissions', () => {
  it('returns null for null input', () => {
    assert.strictEqual(normalizeRolePermissions(null), null);
  });

  it('returns null for undefined input', () => {
    assert.strictEqual(normalizeRolePermissions(undefined), null);
  });

  it('converts boolean true to full CRUD object', () => {
    const role = { name: 'test', members: true };
    const result = normalizeRolePermissions(role);
    assert.deepStrictEqual(result.members, { read: true, create: true, update: true, delete: true });
  });

  it('converts boolean false to empty CRUD object', () => {
    const role = { name: 'test', members: false };
    const result = normalizeRolePermissions(role);
    assert.deepStrictEqual(result.members, { read: false, create: false, update: false, delete: false });
  });

  it('converts undefined permission to empty CRUD object', () => {
    const role = { name: 'test' };
    const result = normalizeRolePermissions(role);
    assert.deepStrictEqual(result.members, { read: false, create: false, update: false, delete: false });
  });

  it('preserves existing CRUD objects', () => {
    const crudObj = { read: true, create: false, update: true, delete: false };
    const role = { name: 'test', members: crudObj };
    const result = normalizeRolePermissions(role);
    assert.deepStrictEqual(result.members, crudObj);
  });

  it('preserves admin flag (roles === true)', () => {
    const role = { name: 'admin', roles: true, members: true };
    const result = normalizeRolePermissions(role);
    assert.strictEqual(result.roles, true);
  });

  it('does not modify boolean module permissions', () => {
    const role = { name: 'test', dashboard: true, orbat: false, logs: true, settings: false };
    const result = normalizeRolePermissions(role);
    assert.strictEqual(result.dashboard, true);
    assert.strictEqual(result.orbat, false);
    assert.strictEqual(result.logs, true);
    assert.strictEqual(result.settings, false);
  });

  it('normalizes all CRUD modules', () => {
    const role = { name: 'full' };
    for (const mod of CRUD_MODULES) {
      role[mod] = true;
    }
    const result = normalizeRolePermissions(role);
    for (const mod of CRUD_MODULES) {
      // 'roles' is special - it's the admin flag and gets restored
      if (mod === 'roles') continue;
      assert.deepStrictEqual(result[mod], { read: true, create: true, update: true, delete: true }, `${mod} should be normalized`);
    }
  });

  it('preserves non-permission fields', () => {
    const role = { _id: '123', name: 'test', color: '#ff0000' };
    const result = normalizeRolePermissions(role);
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

describe('getPermissionModule', () => {
  it('returns correct module for members', () => {
    assert.strictEqual(getPermissionModule('members'), 'members');
  });

  it('returns events module for attendances', () => {
    assert.strictEqual(getPermissionModule('attendances'), 'events');
  });

  it('returns members module for profilePictures', () => {
    assert.strictEqual(getPermissionModule('profilePictures'), 'members');
  });

  it('returns questionnaires module for questionnaireResponses', () => {
    assert.strictEqual(getPermissionModule('questionnaireResponses'), 'questionnaires');
  });

  it('returns null for unknown collection', () => {
    assert.strictEqual(getPermissionModule('unknownCollection'), null);
  });

  it('returns correct module for all mapped collections', () => {
    const expectedMappings = {
      attendances: 'events',
      discoveryTypes: 'discoveryTypes',
      events: 'events',
      eventTypes: 'eventTypes',
      medals: 'medals',
      members: 'members',
      positions: 'positions',
      profilePictures: 'members',
      questionnaires: 'questionnaires',
      questionnaireResponses: 'questionnaires',
      ranks: 'ranks',
      registrations: 'registrations',
      roles: 'roles',
      specializations: 'specializations',
      squads: 'squads',
      tasks: 'tasks',
      taskStatus: 'taskStatus',
    };
    for (const [collection, module] of Object.entries(expectedMappings)) {
      assert.strictEqual(getPermissionModule(collection), module, `${collection} should map to ${module}`);
    }
  });
});

describe('BOOLEAN_MODULES', () => {
  it('contains dashboard, orbat, logs, settings', () => {
    assert.deepStrictEqual(BOOLEAN_MODULES.sort(), ['dashboard', 'logs', 'orbat', 'settings']);
  });
});

describe('CRUD_MODULES', () => {
  it('contains all expected modules', () => {
    const expected = [
      'discoveryTypes', 'events', 'eventTypes', 'medals', 'members',
      'positions', 'questionnaires', 'ranks', 'registrations', 'roles',
      'specializations', 'squads', 'tasks', 'taskStatus',
    ];
    assert.deepStrictEqual([...CRUD_MODULES].sort(), expected.sort());
  });

  it('does not overlap with BOOLEAN_MODULES', () => {
    for (const mod of CRUD_MODULES) {
      assert.ok(!BOOLEAN_MODULES.includes(mod), `${mod} should not be in both CRUD and BOOLEAN modules`);
    }
  });
});
