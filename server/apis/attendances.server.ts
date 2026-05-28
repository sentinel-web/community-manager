import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import { checkPermission, validateNumber, validateString, validateUserId } from '../main';
import { createLog } from './logs.server';
import type { AttendanceStatus } from '/imports/api/types/shared';

const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [-2, -1, 0, 1, 2];

function isAttendanceStatus(value: number): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly number[]).includes(value);
}

if (Meteor.isServer) {
  Meteor.methods({
    /**
     * Atomically record a member's attendance status for an event (#261).
     *
     * The grid stores exactly one attendance document per event, with each
     * member's status held under a dynamic `[memberId]` key. The previous
     * client flow read-then-wrote (find the row, then insert-or-update), which
     * raced: two concurrent writers could both observe "no row yet" and each
     * insert a fresh per-event document. A single `upsertAsync` keyed on
     * `eventId` collapses that into one atomic operation, and the unique
     * `{ eventId }` index (see server/main.ts) guarantees a single row even
     * under concurrency.
     */
    'attendances.upsert': async function (eventId: string = '', memberId: string = '', status: number = 0): Promise<boolean> {
      validateUserId(this.userId);
      validateString(eventId, false);
      validateString(memberId, false);
      validateNumber(status, false);
      if (!isAttendanceStatus(status)) {
        throw new Meteor.Error(400, 'Invalid attendance status');
      }
      const allowed = await checkPermission(this.userId, 'events', 'update');
      if (!allowed) throw new Meteor.Error(403, 'Forbidden');

      await AttendancesCollection.upsertAsync({ eventId } as never, { $set: { eventId, [memberId]: status } } as never);

      await createLog('attendances.upserted', { userId: this.userId, eventId, memberId, status });

      return true;
    },
  });
}
