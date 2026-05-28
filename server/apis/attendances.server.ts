import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import { checkPermission, validateNumber, validateString } from '../main';
import { createLog } from './logs.server';
import type { AttendanceStatus } from '/imports/api/types/shared';

const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [-2, -1, 0, 1, 2];

// Mongo/Meteor document ids are 17–24 alphanumerics. The member id is written
// as a dynamic `[memberId]` document key, so it must be vetted against this
// strict shape before reaching the database — anything containing `.`/`$` (or
// colliding with a structural field) could shadow or rewrite indexed state.
const ID_PATTERN = /^[A-Za-z0-9]{17,24}$/;

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
     * `{ eventId }` index (built by ensureAttendancesUniqueIndex in
     * server/main.ts) guarantees a single row even under concurrency.
     */
    'attendances.upsert': async function (eventId: string = '', memberId: string = '', status: number = 0): Promise<boolean> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateString(eventId, false);
      validateString(memberId, false);
      validateNumber(status, false);
      if (!isAttendanceStatus(status)) {
        throw new Meteor.Error(400, 'Invalid attendance status');
      }
      // `memberId` becomes a dynamic document key, so harden it before the write:
      // enforce the strict id shape, forbid Mongo operator/path chars, and refuse
      // ids that would collide with the structural `eventId`/`_id` fields.
      if (!ID_PATTERN.test(memberId) || memberId === eventId || memberId === '_id' || memberId.includes('.') || memberId.includes('$')) {
        throw new Meteor.Error(400, 'Invalid memberId');
      }
      const allowed = await checkPermission(this.userId, 'events', 'update');
      if (!allowed) throw new Meteor.Error(403, 'Forbidden');

      const member = await MembersCollection.findOneAsync({ _id: memberId }, { fields: { _id: 1 } });
      if (!member) throw new Meteor.Error(404, 'Unknown member');

      // Write the member's status under the dynamic key while pinning `eventId`
      // via $setOnInsert — keeping the dynamic key out of the selector-mirrored
      // $set means it can never shadow the indexed { eventId } field.
      await AttendancesCollection.upsertAsync({ eventId } as never, { $set: { [memberId]: status }, $setOnInsert: { eventId } } as never);

      await createLog('attendances.upserted', { userId: this.userId, eventId, memberId, status });

      return true;
    },
  });
}
