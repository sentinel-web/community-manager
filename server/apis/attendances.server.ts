import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import type { MemberPoints } from '../../imports/api/attendance/points';
import { isAttendanceStatus } from '../../imports/api/attendance/status';
import { PUBLISH_LIMITS } from '../../imports/config';
import { loadMemberPoints } from '../attendance-points';
import { checkPermission, getSquadScope, validateArrayOfStrings, validateNumber, validateString } from '../main';
import { createLog } from './logs.server';

// Mongo/Meteor document ids are 17–24 alphanumerics. The member id is written
// as a dynamic `[memberId]` document key, so it must be vetted against this
// strict shape before reaching the database — anything containing `.`/`$` (or
// colliding with a structural field) could shadow or rewrite indexed state.
const ID_PATTERN = /^[A-Za-z0-9]{17,24}$/;

if (Meteor.isServer) {
  Meteor.methods({
    /**
     * True attendance/inactivity point totals for the given members (#363).
     *
     * The attendance grid only loads the events in its current view, so it
     * cannot derive totals itself; this returns the same all-time totals the
     * member profile shows (one shared calculation, server/attendance-points.ts).
     * Authorized like the grid's own data: `events.read` (the attendances
     * publication's gate) plus the squad scope of the members publication, so
     * unknown or out-of-scope members are simply omitted.
     */
    'attendances.pointsSummary': async function (memberIds: string[] = []): Promise<Record<string, MemberPoints>> {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateArrayOfStrings(memberIds, false);
      if (memberIds.length > PUBLISH_LIMITS.MAX) {
        throw new Meteor.Error(400, `At most ${PUBLISH_LIMITS.MAX} member ids are allowed`);
      }
      const allowed = await checkPermission(this.userId, 'events', 'read');
      if (!allowed) throw new Meteor.Error(403, 'Forbidden');
      if (!memberIds.length) return {};

      const squadScope = await getSquadScope(this.userId);
      const members = await MembersCollection.find(
        { _id: { $in: memberIds }, ...squadScope },
        { fields: { 'profile.staticAttendancePoints': 1, 'profile.staticInactivityPoints': 1 } }
      ).fetchAsync();
      return loadMemberPoints(members);
    },
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
