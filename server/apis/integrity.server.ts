import { Meteor } from 'meteor/meteor';
import { runMutation } from '../mutation-pipeline';
import { COLLECTION_REGISTRY } from '../collection-registry';
import { previewIntegrity, scanForOrphans } from '../integrity';
import { checkPermission, validateString } from '../main';
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

    // Read-only walk of the entire foreign-key graph. Returns every
    // reference whose target doc no longer exists. Admin-only because the
    // result reveals every collection's id space at once — too broad to
    // gate per-target.
    'integrity.scan': async function () {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      const isAdmin = await checkPermission(this.userId, 'logs');
      // 'logs' is a boolean-module gate that admins have by default; using
      // it (rather than e.g. a new permission) keeps the surface narrow
      // without inventing a new role flag for a single CLI tool.
      if (!isAdmin) throw new Meteor.Error(403, 'Admin only');
      return scanForOrphans();
    },
  });
}
