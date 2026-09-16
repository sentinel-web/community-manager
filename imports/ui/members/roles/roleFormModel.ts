import type { LocaleKey } from '/imports/i18n';
import type { CrudPermission, Role } from '/imports/api/types/role';

// Pure model <-> form-values transforms for RolesForm, kept DOM-free so they
// are unit-testable (tests/server/roleFormModel.test.ts).
//
// `roles` is overloaded on a Role document: `roles: true` is the super-admin
// grant (checkPermission short-circuits on it), while `roles: { read, ... }` is
// the ordinary CRUD permission on the roles collection. The form therefore
// exposes the admin grant as its own switch and never converts `roles: true`
// into a CRUD object — doing so silently demoted admins (#354).
//
// Layering: these transforms only decide what THIS FORM submits. They are not a
// security control — a crafted DDP call bypasses them entirely. Whether a
// caller may set `roles: true` at all is enforced server-side, in
// PRIVILEGED_FIELD_GUARDS (server/crud.lib.ts).

// Form-only key: double-underscored so it can never collide with a real Role
// field, and stripped from the payload by buildRolePayload.
export const ADMIN_FIELD = '__isAdmin';

// Modules that use CRUD permissions - label keys reference navigation translations.
// `as const satisfies` preserves the literal union of labelKey values so t(labelKey)
// resolves to a paramless LocaleKey rather than the full LocaleKey union.
export const CRUD_MODULES = [
  { name: 'members', labelKey: 'navigation.members' },
  { name: 'events', labelKey: 'navigation.events' },
  { name: 'tasks', labelKey: 'navigation.tasks' },
  { name: 'squads', labelKey: 'navigation.squads' },
  { name: 'ranks', labelKey: 'navigation.ranks' },
  { name: 'specializations', labelKey: 'navigation.specializations' },
  { name: 'medals', labelKey: 'navigation.medals' },
  { name: 'eventTypes', labelKey: 'navigation.eventTypes' },
  { name: 'briefingTemplates', labelKey: 'navigation.briefingTemplates' },
  { name: 'taskStatus', labelKey: 'navigation.taskStatus' },
  { name: 'registrations', labelKey: 'navigation.registrations' },
  { name: 'discoveryTypes', labelKey: 'navigation.discoveryTypes' },
  { name: 'roles', labelKey: 'navigation.roles' },
  { name: 'questionnaires', labelKey: 'navigation.questionnaires' },
  { name: 'positions', labelKey: 'navigation.positions' },
] as const satisfies readonly { name: keyof Role; labelKey: LocaleKey }[];

function noCrudPermission(): CrudPermission {
  return { read: false, create: false, update: false, delete: false };
}

/**
 * Normalizes a stored module permission into the CRUD object the checkboxes
 * bind to. Legacy `true` means full CRUD; `false`/missing means none.
 */
export function normalizeCrudPermission(value: unknown): CrudPermission {
  if (value === true) {
    return { read: true, create: true, update: true, delete: true };
  }
  if (typeof value === 'object' && value !== null) {
    return value as CrudPermission;
  }
  return noCrudPermission();
}

/**
 * Stored role -> form initial values. `roles: true` turns the admin switch on
 * (the roles-collection checkboxes start empty so turning the switch off never
 * leaves an implicit grant behind); every CRUD module is normalized.
 */
export function prepareRoleForForm(model: Partial<Role> | null | undefined): Record<string, unknown> {
  const source: Partial<Role> = model ?? {};
  const isAdmin = source.roles === true;
  const prepared: Record<string, unknown> = { ...source, [ADMIN_FIELD]: isAdmin };
  for (const { name } of CRUD_MODULES) {
    prepared[name] = name === 'roles' && isAdmin ? noCrudPermission() : normalizeCrudPermission(source[name]);
  }
  return prepared;
}

/**
 * Form values -> wire payload. Within this form the admin switch is the only
 * thing that produces `roles: true`; with it off, `roles` is always a CRUD
 * object. The server decides whether the caller may send `roles: true` at all.
 */
export function buildRolePayload(values: Record<string, unknown>): Record<string, unknown> {
  const { [ADMIN_FIELD]: isAdmin, ...rest } = values;
  if (isAdmin === true) {
    return { ...rest, roles: true };
  }
  return { ...rest, roles: rest.roles === true ? noCrudPermission() : normalizeCrudPermission(rest.roles) };
}
