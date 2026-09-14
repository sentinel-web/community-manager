import type { CrudCollectionName, Role } from '/imports/api/types';

/**
 * Client-side mirror of the permission-relevant slice of COLLECTION_REGISTRY
 * (server/collection-registry.ts): each collection's permission module and its
 * special-flag fallbacks. The server is authoritative — this only decides what
 * the UI shows. The drift test in tests/server/modulePermissions.test.ts fails
 * if the two diverge. Keep alphabetical.
 */

export type SpecialPermissionFlag = 'canCreateEvents' | 'canManageTasks';

export interface PermissionFallback {
  readonly create?: SpecialPermissionFlag;
  readonly update?: SpecialPermissionFlag;
}

export interface CollectionPermissionEntry {
  readonly module: string;
  readonly fallback?: PermissionFallback;
}

export const COLLECTION_PERMISSIONS: Readonly<Record<CrudCollectionName, CollectionPermissionEntry>> = {
  attendances: { module: 'events' },
  briefingTemplates: { module: 'briefingTemplates' },
  discoveryTypes: { module: 'discoveryTypes' },
  events: { module: 'events', fallback: { create: 'canCreateEvents' } },
  eventTypes: { module: 'eventTypes' },
  logs: { module: 'logs' },
  medals: { module: 'medals' },
  members: { module: 'members' },
  positions: { module: 'positions' },
  profilePictures: { module: 'members' },
  questionnaireResponses: { module: 'questionnaires' },
  questionnaires: { module: 'questionnaires' },
  ranks: { module: 'ranks' },
  registrations: { module: 'registrations' },
  roles: { module: 'roles' },
  specializations: { module: 'specializations' },
  squads: { module: 'squads' },
  taskStatus: { module: 'taskStatus' },
  tasks: { module: 'tasks', fallback: { create: 'canManageTasks', update: 'canManageTasks' } },
};

export interface ModulePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export const NO_PERMISSIONS: Readonly<ModulePermissions> = { canRead: false, canCreate: false, canUpdate: false, canDelete: false };
const ALL_PERMISSIONS: Readonly<ModulePermissions> = { canRead: true, canCreate: true, canUpdate: true, canDelete: true };

export interface PermissionTarget {
  module: string;
  fallback?: PermissionFallback;
}

/**
 * Resolves a collection (or bare module) name to the permission module and
 * fallbacks the server applies to it. `moduleOverride` replaces the module
 * (Section's `permissionModule` prop); fallbacks always follow the collection,
 * as they do in the server's CRUD methods.
 */
export function resolvePermissionTarget(name: string, moduleOverride?: string | null): PermissionTarget {
  const entry = Object.prototype.hasOwnProperty.call(COLLECTION_PERMISSIONS, name) ? COLLECTION_PERMISSIONS[name as CrudCollectionName] : undefined;
  return { module: moduleOverride || entry?.module || name, fallback: entry?.fallback };
}

/**
 * Mirrors the server's authorization (checkPermission + runMutation's fallback
 * flag): `roles: true` grants everything, a legacy `true` module grants full
 * CRUD, a CRUD object grants per operation, and a fallback flag additionally
 * grants the operation it is declared for.
 */
export function getModulePermissions(role: Role | null | undefined, module: string, fallback?: PermissionFallback): ModulePermissions {
  if (!role) return { ...NO_PERMISSIONS };
  if (role.roles === true) return { ...ALL_PERMISSIONS };

  const permission = (role as unknown as Record<string, unknown>)[module];
  let permissions: ModulePermissions;
  if (permission === true) {
    permissions = { ...ALL_PERMISSIONS };
  } else if (typeof permission === 'object' && permission !== null) {
    const crud = permission as Record<string, unknown>;
    permissions = {
      canRead: crud.read === true,
      canCreate: crud.create === true,
      canUpdate: crud.update === true,
      canDelete: crud.delete === true,
    };
  } else {
    permissions = { ...NO_PERMISSIONS };
  }

  if (fallback?.create && role[fallback.create] === true) permissions.canCreate = true;
  if (fallback?.update && role[fallback.update] === true) permissions.canUpdate = true;
  return permissions;
}
