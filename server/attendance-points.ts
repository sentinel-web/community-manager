import AttendancesCollection from '../imports/api/collections/attendances.collection';
import EventsCollection from '../imports/api/collections/events.collection';
import EventTypesCollection from '../imports/api/collections/eventTypes.collection';
import { calculateMemberPoints, collectNoShowEventIds, type MemberPoints, type StaticPoints } from '../imports/api/attendance/points';
import type { AttendanceDoc } from '../imports/api/types/shared';

export interface PointsMember {
  _id: string;
  profile?: StaticPoints;
}

// Member ids are used as dynamic field paths in the attendance query and
// projection, so anything that could be read as a nested path or an operator
// is skipped (such ids can never hold an attendance — attendances.upsert
// rejects them). Their static points still count.
function isQueryableMemberKey(memberId: string): boolean {
  return memberId.length > 0 && !memberId.includes('.') && !memberId.includes('$');
}

/**
 * Event ids whose event type opts out of inactivity points (#366), narrowed to
 * the events where one of the members was actually a no-show. Two batched
 * lookups at most; none when no event type opts out.
 */
async function loadEventIdsExcludedFromInactivity(memberIds: readonly string[], attendances: readonly AttendanceDoc[]): Promise<Set<string>> {
  const noShowEventIds = collectNoShowEventIds(memberIds, attendances);
  if (!noShowEventIds.size) return new Set();

  const excludedTypeIds = await EventTypesCollection.find({ countsForInactivity: false }, { fields: { _id: 1 } }).mapAsync(
    type => type._id as string
  );
  if (!excludedTypeIds.length) return new Set();

  const events = await EventsCollection.find({ _id: { $in: [...noShowEventIds] }, eventType: { $in: excludedTypeIds } } as never, {
    fields: { _id: 1 },
  }).fetchAsync();
  return new Set(events.map(event => event._id as string));
}

/**
 * Loads every attendance of the given members and applies the shared points
 * calculation. Used by the attendance grid summary and the profile statistics
 * so both report identical totals (#363).
 */
export async function loadMemberPoints(members: readonly PointsMember[]): Promise<Record<string, MemberPoints>> {
  const memberIds = members.map(member => member._id).filter(isQueryableMemberKey);

  const attendances: AttendanceDoc[] = memberIds.length
    ? await AttendancesCollection.find({ $or: memberIds.map(memberId => ({ [memberId]: { $exists: true } })) } as never, {
        fields: Object.fromEntries([['eventId', 1], ...memberIds.map(memberId => [memberId, 1])]),
      }).fetchAsync()
    : [];
  const excludedEventIds = await loadEventIdsExcludedFromInactivity(memberIds, attendances);

  const result: Record<string, MemberPoints> = {};
  for (const member of members) {
    const memberAttendances = isQueryableMemberKey(member._id) ? attendances : [];
    result[member._id] = calculateMemberPoints(member._id, member.profile, memberAttendances, excludedEventIds);
  }
  return result;
}
