import { createContext, useContext } from 'react';
import type { Role } from '/imports/api/types';

export interface OwnRoleState {
  /** The caller's role document, or `undefined` while logged out, unassigned or still loading. */
  readonly role: Role | undefined;
  /**
   * True while the answer is not known yet (the user document or the role
   * subscription is still in flight). Callers must render a loading state
   * rather than "access denied" while this is set — a falsy `role` alone does
   * not mean "no permissions" (#355).
   */
  readonly loading: boolean;
}

// Logged out is a known answer, not a pending one: no user, nothing to wait for.
export const OWN_ROLE_LOGGED_OUT: OwnRoleState = { role: undefined, loading: false };

export const OwnRoleContext = createContext<OwnRoleState>(OWN_ROLE_LOGGED_OUT);

/**
 * The current user's own role document plus its loading state.
 *
 * Reads the single `roles.own` subscription held by `OwnRoleProvider` (mounted
 * once in App). Meteor only de-duplicates *inactive* subscriptions, so
 * subscribing per consumer meant one DDP subscription — and one server-side
 * findOne — per mounted Section/CollectionSelect (a MemberForm alone mounts
 * ~8 of them).
 */
export default function useOwnRole(): OwnRoleState {
  return useContext(OwnRoleContext);
}
