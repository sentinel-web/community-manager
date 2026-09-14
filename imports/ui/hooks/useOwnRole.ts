import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import RolesCollection from '/imports/api/collections/roles.collection';
import type { Role } from '/imports/api/types';

/**
 * The current user's own role document, or `undefined` while logged out,
 * unassigned or still loading.
 *
 * Loads through the dedicated `roles.own` publication (server/apis/roles.server.ts),
 * which serves the caller's role regardless of `roles.read` — the generic
 * `roles` publication is permission-gated, so members without that flag used to
 * see an empty UI (#355). The roleId argument is only a resubscribe key; the
 * server derives the published role from the stored user document.
 */
export default function useOwnRole(): Role | undefined {
  const roleId = useTracker(() => (Meteor.user()?.profile?.roleId as string | undefined) ?? null, []);
  useSubscribe(roleId ? 'roles.own' : undefined, roleId);
  const roles = useFind(() => RolesCollection.find({ _id: roleId ?? '' }, { limit: 1 }), [roleId]);
  return roleId ? roles[0] : undefined;
}
