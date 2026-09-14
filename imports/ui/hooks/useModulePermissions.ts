import { useMemo } from 'react';
import { NO_PERMISSIONS, getModulePermissions, resolvePermissionTarget, type ModulePermissions } from '/imports/api/permissions/modulePermissions';
import useOwnRole from './useOwnRole';

/**
 * The current user's permissions for a collection's permission module,
 * including special-flag fallbacks (e.g. `canCreateEvents`), computed from the
 * user's own role. Shared by Section and CollectionSelect so both gate their
 * create/edit/delete affordances identically. UI-only: the server re-checks.
 *
 * @param name collection (or module) name, e.g. `'events'`; empty/undefined yields no permissions
 * @param moduleOverride explicit permission module, when it differs from the collection's registry module
 */
export default function useModulePermissions(name: string | undefined, moduleOverride?: string | null): ModulePermissions {
  const role = useOwnRole();
  return useMemo(() => {
    if (!name && !moduleOverride) return { ...NO_PERMISSIONS };
    const { module, fallback } = resolvePermissionTarget(name ?? '', moduleOverride);
    return getModulePermissions(role, module, fallback);
  }, [role, name, moduleOverride]);
}
