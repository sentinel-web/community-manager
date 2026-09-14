import assert from 'node:assert';
import { ADMIN_FIELD, CRUD_MODULES, buildRolePayload, prepareRoleForForm } from '../../imports/ui/members/roles/roleFormModel';
import type { Role } from '/imports/api/types';

// RolesForm model transforms (#354): saving the Admin role (`roles: true`)
// must never downgrade it to a CRUD object.

const NONE = { read: false, create: false, update: false, delete: false };
const FULL = { read: true, create: true, update: true, delete: true };

// What an unchanged form submits: the prepared initial values, round-tripped.
function saveUnchanged(model: Partial<Role>): Record<string, unknown> {
  return buildRolePayload(prepareRoleForForm(model));
}

describe('RolesForm model — admin grant (#354)', () => {
  it('maps roles: true to the admin switch without converting it into CRUD permissions', () => {
    const values = prepareRoleForForm({ name: 'Admin', roles: true });
    assert.strictEqual(values[ADMIN_FIELD], true);
    assert.notDeepStrictEqual(values.roles, FULL, 'roles: true must not be expanded into a CRUD object');
  });

  it('keeps roles: true when an unchanged admin role is saved', () => {
    const payload = saveUnchanged({ name: 'Admin', roles: true });
    assert.strictEqual(payload.roles, true);
    assert.strictEqual(ADMIN_FIELD in payload, false, 'the form-only admin field must not reach the server');
  });

  it('keeps roles: true for an admin role with other module permissions set', () => {
    const payload = saveUnchanged({ name: 'Admin', roles: true, members: { read: true } });
    assert.strictEqual(payload.roles, true);
  });

  it('submits roles: true when the admin switch is turned on', () => {
    const values = prepareRoleForForm({ name: 'Officer', roles: { read: true } });
    const payload = buildRolePayload({ ...values, [ADMIN_FIELD]: true });
    assert.strictEqual(payload.roles, true);
  });

  it('submits a CRUD object (never roles: true) when the admin switch is off', () => {
    const values = prepareRoleForForm({ name: 'Admin', roles: true });
    const payload = buildRolePayload({ ...values, [ADMIN_FIELD]: false });
    assert.deepStrictEqual(payload.roles, NONE);
  });

  it('cannot grant admin through a stray roles: true value while the switch is off', () => {
    const payload = buildRolePayload({ name: 'Crafted', roles: true, [ADMIN_FIELD]: false });
    assert.deepStrictEqual(payload.roles, NONE);
  });

  it('treats a missing admin field as non-admin', () => {
    const payload = buildRolePayload({ name: 'New', roles: { read: true } });
    assert.deepStrictEqual(payload.roles, { read: true });
  });
});

describe('RolesForm model — CRUD modules', () => {
  it('prepares an empty create form with the admin switch off and every module empty', () => {
    const values = prepareRoleForForm(undefined);
    assert.strictEqual(values[ADMIN_FIELD], false);
    for (const { name } of CRUD_MODULES) {
      assert.deepStrictEqual(values[name], NONE, `${name} should start empty`);
    }
  });

  it('expands legacy boolean module permissions and preserves CRUD objects', () => {
    const values = prepareRoleForForm({ name: 'Mixed', members: true, events: false, tasks: { read: true, update: true } });
    assert.deepStrictEqual(values.members, FULL);
    assert.deepStrictEqual(values.events, NONE);
    assert.deepStrictEqual(values.tasks, { read: true, update: true });
  });

  it('preserves a non-admin roles CRUD object on round-trip', () => {
    const payload = saveUnchanged({ name: 'Recruiter', roles: { read: true, create: false, update: false, delete: false } });
    assert.deepStrictEqual(payload.roles, { read: true, create: false, update: false, delete: false });
  });
});
