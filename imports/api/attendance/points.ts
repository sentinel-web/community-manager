import type { AttendanceDoc } from '../types/shared';
import { isAttendanceStatus } from './status';

/**
 * The single attendance/inactivity points calculation (#363), shared by
 * `attendances.pointsSummary` (attendance grid) and `members.profileStats`
 * (profile + dashboard) so both always show the same totals.
 *
 * Rules, per attendance status of the member:
 *   -2 event cancelled  → ignored
 *   -1 absent/unexcused → +1 inactivity point, -1 attendance point
 *    0 excused          → nothing
 *    1 present          → +1 attendance point
 *    2 present (Zeus)   → +1 attendance point
 * Missing or non-status values are ignored. Both totals start from the
 * member's static points.
 *
 * Event types with `countsForInactivity: false` (#366): a no-show at such an
 * event adds NO inactivity point. Only the inactivity point is affected — the
 * attendance-point penalty still applies.
 */

export interface StaticPoints {
  staticAttendancePoints?: number | null;
  staticInactivityPoints?: number | null;
}

export interface MemberPoints {
  attendancePoints: number;
  inactivityPoints: number;
}

const NO_SHOW = -1;

export function calculateMemberPoints(
  memberId: string,
  staticPoints: StaticPoints | undefined,
  attendances: readonly AttendanceDoc[],
  eventIdsExcludedFromInactivity: ReadonlySet<string> = new Set()
): MemberPoints {
  let attendancePoints = staticPoints?.staticAttendancePoints || 0;
  let inactivityPoints = staticPoints?.staticInactivityPoints || 0;

  for (const attendance of attendances) {
    const status = attendance[memberId];
    if (!isAttendanceStatus(status) || status === -2) continue;
    if (status === NO_SHOW) {
      attendancePoints -= 1;
      if (!eventIdsExcludedFromInactivity.has(attendance.eventId as string)) inactivityPoints += 1;
    } else if (status > 0) {
      attendancePoints += 1;
    }
  }

  return { attendancePoints, inactivityPoints };
}

/**
 * Event ids where at least one of the members was an unexcused no-show.
 *
 * Walks each document's own keys against a Set of member ids rather than
 * probing the document once per member, so the cost is the number of graded
 * members on the document instead of members × documents.
 */
export function collectNoShowEventIds(memberIds: readonly string[], attendances: readonly AttendanceDoc[]): Set<string> {
  const wanted = new Set<string>(memberIds);
  const eventIds = new Set<string>();
  for (const attendance of attendances) {
    const eventId = attendance.eventId;
    if (!eventId || eventIds.has(eventId)) continue;
    for (const [key, value] of Object.entries(attendance)) {
      if (value === NO_SHOW && wanted.has(key)) {
        eventIds.add(eventId);
        break;
      }
    }
  }
  return eventIds;
}
