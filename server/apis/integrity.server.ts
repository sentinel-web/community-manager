import { Meteor } from 'meteor/meteor';
import { runMutation } from '../mutation-pipeline';
import { COLLECTION_REGISTRY } from '../collection-registry';
import { previewIntegrity } from '../integrity';
import { validateString } from '../main';
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
  });
}
