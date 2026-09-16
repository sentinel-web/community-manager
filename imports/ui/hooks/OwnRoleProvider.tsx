import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { ReactNode, useMemo } from 'react';
import RolesCollection from '/imports/api/collections/roles.collection';
import { OwnRoleContext, type OwnRoleState } from './useOwnRole';

interface OwnRoleProviderProps {
  children?: ReactNode;
}

/**
 * Holds the app's single `roles.own` subscription and shares the resulting role
 * through OwnRoleContext. Mounted once, at the root of App.
 *
 * `roles.own` (server/apis/roles.server.ts) serves the caller's role regardless
 * of `roles.read` — the generic `roles` publication is permission-gated, so
 * members without that flag used to see an empty UI (#355). The roleId argument
 * is only a resubscribe key; the server derives the published role from the
 * stored user document.
 */
export default function OwnRoleProvider({ children }: OwnRoleProviderProps) {
  const roleId = useTracker(() => (Meteor.user()?.profile?.roleId as string | undefined) ?? null, []);
  // Logged in, but the user document has not arrived over DDP yet: the role is
  // unknown rather than absent, so this counts as loading.
  const userPending = useTracker(() => !!Meteor.userId() && !Meteor.user(), []);
  const subscriptionLoading = useSubscribe(roleId ? 'roles.own' : undefined, roleId);
  const roles = useFind(() => RolesCollection.find({ _id: roleId ?? '' }, { limit: 1 }), [roleId]);

  const role = roleId ? roles[0] : undefined;
  const loading = userPending || (!!roleId && subscriptionLoading());
  const value = useMemo<OwnRoleState>(() => ({ role, loading }), [role, loading]);

  return <OwnRoleContext.Provider value={value}>{children}</OwnRoleContext.Provider>;
}
