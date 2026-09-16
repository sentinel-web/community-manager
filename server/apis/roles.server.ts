import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import { validateString } from '../main';

// `roles.own` — the caller's own role document, regardless of `roles.read` (#355).
//
// The client needs its own role to compute which menu entries, pages and
// buttons to show. The generic `roles` publication (crud.lib.ts) is gated on
// `roles.read`, so a member without it received nothing and the UI rendered as
// if they had no permissions at all, even though the server would authorize
// their actions.
//
// Security: the published selector is derived exclusively server-side from the
// caller's stored `profile.roleId`. The optional argument is NOT trusted and
// never reaches a query — the client passes its current roleId only so that a
// role reassignment changes the subscription arguments and forces a resubscribe
// (publications do not re-run on their own when the user document changes).
if (Meteor.isServer) {
  Meteor.publish('roles.own', async function (roleIdHint?: unknown) {
    if (!this.userId) return this.ready();
    // The hint is never trusted, but a malformed one still means a broken
    // caller, so reject anything that is not an omitted value or a non-empty
    // string. `validateString(hint, true)` would not do: its optional mode only
    // rejects *truthy* non-strings, waving 0 / false / null through.
    if (roleIdHint !== undefined && roleIdHint !== null) validateString(roleIdHint, false);

    const user = await MembersCollection.findOneAsync({ _id: this.userId }, { fields: { 'profile.roleId': 1 } });
    const roleId = user?.profile?.roleId;
    if (typeof roleId !== 'string' || roleId.length === 0) return this.ready();

    return RolesCollection.find({ _id: roleId }, { limit: 1 });
  });
}
