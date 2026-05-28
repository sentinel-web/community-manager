import { Meteor } from 'meteor/meteor';
import { runMutation } from '../mutation-pipeline';
import { COLLECTION_REGISTRY } from '../collection-registry';
import {
  previewIntegrity,
  previewIntegrityBulk,
  resolveOrphans,
  scanForOrphans,
  type OrphanRecord,
  type OrphanResolution,
} from '../integrity';
import { validateArrayOfStrings, validateBoolean, validateString } from '../main';
import type { CrudCollectionName } from '/imports/api/types';

if (Meteor.isServer) {
  Meteor.methods({
    'integrity.preview': async function (collection: string = '', id: string = '') {
      const callerUserId = this.userId;

      // Reject unknown collections before runMutation so the permission
      // check below has a real module to check against.
      if (!(collection in COLLECTION_REGISTRY)) {
        throw new Meteor.Error(400, 'Invalid collection');
      }
      const target = collection as CrudCollectionName;
      const targetModule = COLLECTION_REGISTRY[target].module;

      return runMutation(
        { userId: callerUserId },
        {
          collection: target,
          operation: 'delete',
          permissionModule: targetModule,
          validate: ([c, i]) => {
            validateString(c, false);
            validateString(i, false);
          },
        },
        [collection, id] as const,
        async ([, targetId]) => previewIntegrity(target, targetId, { userId: callerUserId }),
      );
    },

    // Batched preview for bulk-delete UX. Returns per-id previews plus
    // an aggregate so the modal can render "N of M entries blocked" and
    // sum side-effect counts in a single round-trip.
    'integrity.previewBulk': async function (collection: string = '', ids: string[] = []) {
      const callerUserId = this.userId;
      if (!(collection in COLLECTION_REGISTRY)) {
        throw new Meteor.Error(400, 'Invalid collection');
      }
      const target = collection as CrudCollectionName;
      const targetModule = COLLECTION_REGISTRY[target].module;

      return runMutation(
        { userId: callerUserId },
        {
          collection: target,
          operation: 'delete',
          permissionModule: targetModule,
          validate: ([c, i]) => {
            validateString(c, false);
            validateArrayOfStrings(i, false);
            if (i.length === 0) throw new Meteor.Error(400, 'No ids provided');
            if (i.length > 100) throw new Meteor.Error(400, 'Maximum 100 items per bulk preview');
          },
        },
        [collection, ids] as const,
        async ([, targetIds]) => previewIntegrityBulk(target, targetIds, { userId: callerUserId }),
      );
    },

    // Read-only walk of the entire foreign-key graph. Returns every
    // reference whose target doc no longer exists. Strict admin-only
    // because the result reveals every collection's id space at once —
    // too broad to gate per-module.
    'integrity.scan': async function () {
      return runMutation(
        { userId: this.userId },
        {
          collection: 'logs',
          operation: 'read',
          action: 'integrity.scan',
          // Strict admin-only gate. `__admin_only__` is a deliberately
          // unknown module name. checkPermission in main.ts short-circuits
          // to true for admins (`role.roles === true`) before reading the
          // module, so admins pass. Every non-admin role falls through to
          // the module-not-recognised branch and is denied — no role in
          // the system declares this synthetic module. runMutation emits
          // a standard `integrity.scan.denied` audit entry on failure and
          // the custom `audit` callback below records success with the
          // orphan count.
          permissionModule: '__admin_only__',
          audit: (_args, result) => ({
            orphanCount: (result as OrphanRecord[]).length,
          }),
        },
        [] as const,
        async () => scanForOrphans(),
      );
    },

    // One-off ORPHAN MIGRATION (decision O-6). Resolves pre-existing orphaned
    // references by applying each edge's declared on-delete primitive
    // (pull / setNull); block/cascade orphans are reported as `skipped` for
    // manual operator reconciliation. MUST be run before full-document FK
    // enforcement is enabled on a populated database, or edits to already-
    // orphaned rows will start failing.
    //
    // Pass `dryRun: true` to count what WOULD be resolved without mutating —
    // run that first, review the `skipped` list, then run with dryRun:false.
    // Same strict admin-only gate as integrity.scan: the synthetic
    // `__admin_only__` module admits only role.roles === true.
    'integrity.scanResolve': async function (dryRun: boolean = false) {
      return runMutation(
        { userId: this.userId },
        {
          collection: 'logs',
          operation: 'read',
          action: 'integrity.scanResolve',
          permissionModule: '__admin_only__',
          validate: ([d]) => validateBoolean(d, true),
          audit: (args, result) => {
            const r = result as OrphanResolution;
            return { dryRun: args[0], pulled: r.pulled, setNull: r.setNull, skipped: r.skipped.length };
          },
        },
        [dryRun] as const,
        async ([d]) => resolveOrphans({ dryRun: d }),
      );
    },
  });
}
