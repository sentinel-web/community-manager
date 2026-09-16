import assert from 'node:assert';
import { calculateMemberPoints, collectNoShowEventIds } from '../../imports/api/attendance/points';
import type { AttendanceDoc } from '../../imports/api/types/shared';

// The single points calculation shared by the attendance grid (via
// attendances.pointsSummary) and the member profile/dashboard
// (members.profileStats) — see #363 and #366.

const MEMBER = 'memberA';
const OTHER = 'memberB';

function attendance(eventId: string, statuses: Record<string, unknown>): AttendanceDoc {
  return { _id: `att-${eventId}`, eventId, ...statuses } as AttendanceDoc;
}

describe('calculateMemberPoints (#363)', () => {
  it('starts from the static points and returns zero without attendances', () => {
    assert.deepStrictEqual(calculateMemberPoints(MEMBER, { staticAttendancePoints: 4, staticInactivityPoints: 2 }, []), {
      attendancePoints: 4,
      inactivityPoints: 2,
    });
    assert.deepStrictEqual(calculateMemberPoints(MEMBER, undefined, []), { attendancePoints: 0, inactivityPoints: 0 });
    assert.deepStrictEqual(calculateMemberPoints(MEMBER, { staticAttendancePoints: null, staticInactivityPoints: null }, []), {
      attendancePoints: 0,
      inactivityPoints: 0,
    });
  });

  it('adds one attendance point for present and for present (Zeus)', () => {
    const result = calculateMemberPoints(MEMBER, {}, [attendance('e1', { [MEMBER]: 1 }), attendance('e2', { [MEMBER]: 2 })]);
    assert.deepStrictEqual(result, { attendancePoints: 2, inactivityPoints: 0 });
  });

  it('adds nothing for excused', () => {
    assert.deepStrictEqual(calculateMemberPoints(MEMBER, {}, [attendance('e1', { [MEMBER]: 0 })]), { attendancePoints: 0, inactivityPoints: 0 });
  });

  it('counts an unexcused absence as one inactivity point and minus one attendance point', () => {
    assert.deepStrictEqual(calculateMemberPoints(MEMBER, {}, [attendance('e1', { [MEMBER]: -1 })]), { attendancePoints: -1, inactivityPoints: 1 });
  });

  it('ignores cancelled events, missing statuses, and other members', () => {
    const result = calculateMemberPoints(MEMBER, {}, [
      attendance('e1', { [MEMBER]: -2 }),
      attendance('e2', { [OTHER]: -1 }),
      attendance('e3', { [MEMBER]: null }),
    ]);
    assert.deepStrictEqual(result, { attendancePoints: 0, inactivityPoints: 0 });
  });

  it('ignores values that are not attendance statuses', () => {
    const result = calculateMemberPoints(MEMBER, {}, [attendance('e1', { [MEMBER]: 7 }), attendance('e2', { [MEMBER]: '1' })]);
    assert.deepStrictEqual(result, { attendancePoints: 0, inactivityPoints: 0 });
  });

  it('sums a mixed history on top of static points', () => {
    const result = calculateMemberPoints(MEMBER, { staticAttendancePoints: 10, staticInactivityPoints: 1 }, [
      attendance('e1', { [MEMBER]: 1 }),
      attendance('e2', { [MEMBER]: 2 }),
      attendance('e3', { [MEMBER]: -1 }),
      attendance('e4', { [MEMBER]: 0 }),
      attendance('e5', { [MEMBER]: -2 }),
      attendance('e6', { [MEMBER]: -1 }),
    ]);
    assert.deepStrictEqual(result, { attendancePoints: 10, inactivityPoints: 3 });
  });
});

describe('calculateMemberPoints — countsForInactivity (#366)', () => {
  it('skips the inactivity point of a no-show at an event excluded from inactivity', () => {
    const result = calculateMemberPoints(
      MEMBER,
      {},
      [attendance('social', { [MEMBER]: -1 }), attendance('op', { [MEMBER]: -1 })],
      new Set(['social'])
    );
    assert.strictEqual(result.inactivityPoints, 1);
  });

  it('still applies the attendance-point penalty of that no-show (only IP is affected)', () => {
    const result = calculateMemberPoints(MEMBER, {}, [attendance('social', { [MEMBER]: -1 })], new Set(['social']));
    assert.deepStrictEqual(result, { attendancePoints: -1, inactivityPoints: 0 });
  });

  it('leaves other statuses at excluded events untouched', () => {
    const result = calculateMemberPoints(MEMBER, {}, [attendance('social', { [MEMBER]: 1 })], new Set(['social']));
    assert.deepStrictEqual(result, { attendancePoints: 1, inactivityPoints: 0 });
  });
});

describe('collectNoShowEventIds (#366)', () => {
  it('returns the events where any of the given members was an unexcused no-show', () => {
    const ids = collectNoShowEventIds(
      [MEMBER, OTHER],
      [attendance('e1', { [MEMBER]: -1 }), attendance('e2', { [OTHER]: 1 }), attendance('e3', { [OTHER]: -1 }), attendance('e4', { third: -1 })]
    );
    assert.deepStrictEqual([...ids].sort(), ['e1', 'e3']);
  });

  it('returns each event id once when several of the members were no-shows at it', () => {
    const ids = collectNoShowEventIds([MEMBER, OTHER], [attendance('e1', { [MEMBER]: -1, [OTHER]: -1 })]);
    assert.deepStrictEqual([...ids], ['e1']);
  });

  it('ignores no-shows by members outside the list and non-status values', () => {
    const ids = collectNoShowEventIds(
      [MEMBER],
      [attendance('e1', { [OTHER]: -1 }), attendance('e2', { [MEMBER]: '-1' }), attendance('e3', { [MEMBER]: -2 })]
    );
    assert.deepStrictEqual([...ids], []);
  });

  it('ignores attendance documents without an event id', () => {
    const ids = collectNoShowEventIds([MEMBER], [{ _id: 'orphan', [MEMBER]: -1 } as unknown as AttendanceDoc]);
    assert.deepStrictEqual([...ids], []);
  });

  it('does not treat a structural field name as a member id', () => {
    const ids = collectNoShowEventIds(['eventId', '_id'], [attendance('e1', { [MEMBER]: 1 })]);
    assert.deepStrictEqual([...ids], []);
  });
});
