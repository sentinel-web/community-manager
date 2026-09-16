import { getUserRole, isOfficerOrAdmin } from './main';

/**
 * Private events are visible only to officers/admins and to their own hosts and
 * attendees. Returns the selector restricting a query to the events `userId`
 * may see, or `null` when the caller sees every event.
 *
 * Lives here rather than in `apis/events.server.ts` because three read paths
 * need it — the `events` publication, the id-based `events.detail`/`events.rsvp`
 * methods, and the generated CRUD reads in `crud.lib.ts` — and `crud.lib.ts`
 * cannot import an api module without closing an import cycle through `main.ts`.
 */
export async function getEventVisibilityFilter(userId: string | null | undefined): Promise<Record<string, unknown> | null> {
  const role = await getUserRole(userId);
  if (isOfficerOrAdmin(role)) return null;
  return { $or: [{ isPrivate: { $ne: true } }, { hosts: userId }, { attendees: userId }] };
}

/** ANDs a visibility selector onto a caller-supplied filter, if there is one. */
export function withEventVisibility(filter: Record<string, unknown>, visibility: Record<string, unknown> | null): Record<string, unknown> {
  return visibility ? { $and: [filter, visibility] } : filter;
}
