import dayjs from 'dayjs';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import ProfilePicturesCollection from '../../imports/api/collections/profilePictures.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { validateObject, validatePublish, validateString, validateNumber, validateUserId, checkPermission, checkSpecialPermission, getSquadScope, isOfficerOrAdmin, getUserRole, assertSafeSelector } from '../main';
import { createLog } from './logs.server';
import { runMutation, snapshotTouchedFields } from '../mutation-pipeline';
import { instrument } from '../telemetry';
import { COLLECTION_REGISTRY } from '../collection-registry';
import {
  enforceIntegrityOnDelete,
  buildRemoveAuditPayload,
  validateForeignKeys,
  validateForeignKeysForUpdate,
} from '../integrity';
import type { Role } from '/imports/api/types';

async function getMemberById(memberId: string): Promise<Meteor.User> {
  validateUserId(memberId);
  const member = await MembersCollection.findOneAsync(memberId);
  validateObject(member, false);
  return member as Meteor.User;
}

// Post-fetch removal of the `services` block (bcrypt password hashes + reset
// tokens). Used on every client-reachable path that returns raw member docs.
// A strip-after-fetch is projection-safe: merging `{ services: 0 }` onto a
// caller-supplied INCLUSION projection (e.g. `{ name: 1 }`) makes MongoDB throw,
// and omitting the projection leaks the hash. Deleting the field post-fetch is
// immune to the projection type and can never leak (SEC-001, Critical).
function stripServices<T extends object>(member: T): T {
  if (member && 'services' in member) {
    delete (member as { services?: unknown }).services;
  }
  return member;
}

function stripServicesFromAll<T extends object>(members: T[]): T[] {
  return members.map(stripServices);
}

const getRankName = async (rankId: string | null | undefined): Promise<string | undefined> => {
  const rank = await RanksCollection.findOneAsync({ _id: rankId || null } as never);
  return rank?.name;
};
void getRankName;

const getFullName = (rank: string | undefined, id: number | undefined, name: string | undefined): string => {
  return `${rank || 'Unranked'}-${id || '0000'} ${name || 'Name'}`;
};

if (Meteor.isServer) {
  Meteor.publish('user', function () {
    validateUserId(this.userId);
    return MembersCollection.find({ _id: this.userId }, { fields: { services: 0 } });
  });
  Meteor.publish('members', async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
    validatePublish(this.userId, filter, options);
    const squadScope = await getSquadScope(this.userId);
    const scopedFilter = { ...filter, ...squadScope };
    return MembersCollection.find(scopedFilter, { ...options, fields: { services: 0 } });
  });

  Meteor.methods({
    'members.read': async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      // Telemetry is additive: a permission denial maps to 'denied', any later
      // throw to 'error'. `passedGate` flips once the read is authorized.
      let passedGate = false;
      return instrument(
        'members.read',
        async () => {
          validateUserId(this.userId);
          validateObject(filter, false);
          validateObject(options, false);

          const hasPermission = await checkPermission(this.userId, 'members', 'read');
          if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          passedGate = true;

          const squadScope = await getSquadScope(this.userId);
          const scopedFilter = { ...filter, ...squadScope };
          // Strip the password-hash off every returned doc post-fetch. The caller's
          // `options` (incl. `fields`) are forwarded verbatim, so a projection merge
          // would either throw (inclusion projection) or be omittable — the strip is
          // projection-safe and never leaks (SEC-001, Critical).
          const members = await MembersCollection.find(scopedFilter, options).fetchAsync();
          return stripServicesFromAll(members);
        },
        () => (passedGate ? 'error' : 'denied'),
      );
    },
    'members.findOne': async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      let passedGate = false;
      return instrument(
        'members.findOne',
        async () => {
          validateUserId(this.userId);
          validateObject(filter, false);
          validateObject(options, false);
          assertSafeSelector(filter);

          const hasPermission = await checkPermission(this.userId, 'members', 'read');
          if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
          passedGate = true;

          // Squad-scope the lookup so a scoped caller cannot read members outside
          // their own squad by crafting an arbitrary selector (SEC-001).
          const squadScope = await getSquadScope(this.userId);
          const scopedFilter = { ...filter, ...squadScope };

          // Strip the password-hash off the returned doc post-fetch. A projection
          // merge of `{ services: 0 }` onto a caller-supplied INCLUSION projection
          // (e.g. `{ name: 1 }`) makes MongoDB throw; omitting it leaks the hash.
          // The post-fetch strip is immune to the projection type and never leaks
          // (SEC-001, Critical).
          //
          // Returns undefined on miss (mirrors Mongo findOneAsync) — callers like
          // RegistrationExtra use this as an existence check and would otherwise
          // unhandled-reject on every miss, surfacing as the dev-server overlay.
          const member = await MembersCollection.findOneAsync(scopedFilter, options);
          return member ? stripServices(member) : member;
        },
        () => (passedGate ? 'error' : 'denied'),
      );
    },
    'members.insert': async function (payload: Record<string, unknown> = {}): Promise<string> {
      return runMutation(
        { userId: this.userId },
        {
          collection: 'members',
          operation: 'create',
          action: 'members.created',
          auditShape: 'insert',
          permissionModule: 'members',
          redact: COLLECTION_REGISTRY.members.redact?.insert,
          validate: ([p]) => validateObject(p, false),
        },
        [payload] as const,
        async ([p]) => {
          // members.insert is a custom path (Accounts.createUserAsync, not
          // generic CRUD), so it must opt explicitly into write validation.
          // Validates every FK present on the bare-doc payload — same
          // semantics generic CRUD applies on .insert.
          await validateForeignKeys('members', p);
          return Accounts.createUserAsync(p as Parameters<typeof Accounts.createUserAsync>[0]);
        },
      );
    },
    'members.update': async function (memberId: string = '', data: Record<string, unknown> = {}) {
      const callerUserId = this.userId;
      return runMutation(
        { userId: callerUserId },
        {
          collection: 'members',
          operation: 'update',
          action: 'members.updated',
          auditShape: 'update',
          redact: COLLECTION_REGISTRY.members.redact?.update,
          permissionModule: 'members',
          validate: ([id, d]) => {
            validateString(id, false);
            validateObject(d, false);
          },
          // Snapshot the touched fields' current values for the before→after
          // diff view. Sensitive keys are stripped via the `redact` list above.
          captureBefore: async ([targetId, changes]) => {
            const doc = await MembersCollection.findOneAsync(targetId);
            return doc
              ? snapshotTouchedFields(doc as unknown as Record<string, unknown>, changes as Record<string, unknown>)
              : undefined;
          },
          permissionOverride: async (ctx, [, d]) => {
            // specOnly + canManageSpecializations: a non-update-permitted caller
            // may still mutate `profile.specializationIds` alone. 1-site rule —
            // stays as a callback per the rule of three.
            const changes = d as Record<string, unknown>;
            const isSpecOnly = changes['profile.specializationIds'] && Object.keys(changes).length === 1;
            if (!isSpecOnly) return false;
            return checkSpecialPermission(ctx.userId, 'canManageSpecializations');
          },
        },
        [memberId, data] as const,
        async ([targetId, changes]) => {
          // Existence check + squad-scope reject stay as code in the body — both
          // are 1-site variations and out of scope for the registry. The target-
          // member lookup and the caller-role lookup hit different collections
          // with no dependency between them — race them via Promise.all.
          const [targetMember, role] = await Promise.all([
            getMemberById(targetId),
            getUserRole(callerUserId),
          ]);
          if (!isOfficerOrAdmin(role)) {
            const viewer = await MembersCollection.findOneAsync(callerUserId!);
            if (viewer?.profile?.squadId && targetMember?.profile?.squadId !== viewer.profile.squadId) {
              throw new Meteor.Error(403, 'Cannot update members outside your squad');
            }
          }
          // Full-document FK enforcement (O-6): validate EVERY foreign key on
          // the member as it will exist after this `$set`, not only the touched
          // fields. Reuses the targetMember we already fetched above. Pre-
          // existing orphans on members.profile must be cleared by the orphan
          // migration before this is enabled in production. Supersedes the
          // touched-fields-only path.
          await validateForeignKeysForUpdate('members', targetMember as unknown as Record<string, unknown>, {
            $set: changes,
          });
          return MembersCollection.updateAsync({ _id: targetId } as never, { $set: changes } as never);
        },
      );
    },
    'members.remove': async function (memberId: string = '') {
      const callerUserId = this.userId;
      return runMutation(
        { userId: callerUserId },
        {
          collection: 'members',
          operation: 'delete',
          action: 'members.deleted',
          audit: (args, result) => {
            const r = result as { id: string; effects: Awaited<ReturnType<typeof enforceIntegrityOnDelete>> };
            return buildRemoveAuditPayload(r.id, r.effects);
          },
          permissionModule: 'members',
          validate: ([id]) => validateString(id, false),
        },
        [memberId] as const,
        async ([targetId]) => {
          // Self-delete prevention: an admin deleting their own account
          // would lock themselves out instantly. The integrity layer can't
          // help here — even a clean delete is undesirable. This guard is
          // 1-site, so it stays in the body per the rule of three.
          if (targetId === callerUserId) {
            throw new Meteor.Error(400, 'Cannot delete your own account');
          }

          // Existence check stays as code in the body (1-site variation;
          // not promoted to a registry field per the rule of three).
          const member = await getMemberById(targetId);

          // Run the registry-driven integrity layer (pulls from events,
          // tasks, specializations; sets respondentId null on responses).
          // Generic CRUD .remove does this automatically — members.remove
          // is a custom path so it calls explicitly.
          const effects = await enforceIntegrityOnDelete('members', targetId, { userId: callerUserId });

          // Owned-target cascade: the ProfilePicture is private to one
          // Member, so deleting the Member also deletes their picture.
          // The only owned-target relationship in the registry; per the
          // rule of three (one instance), kept here as code rather than
          // promoted to a registry primitive. See server/integrity.ts.
          const profilePictureId = member.profile?.profilePictureId;
          if (profilePictureId) {
            await ProfilePicturesCollection.removeAsync({ _id: profilePictureId } as never);
            effects.cascaded.profilePictures = (effects.cascaded.profilePictures ?? 0) + 1;
          }

          await MembersCollection.removeAsync({ _id: targetId } as never);
          return { id: targetId, effects };
        },
      );
    },
    'members.saveTaskFilter': async function (filter: Record<string, unknown> = {}) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateObject(filter, false);
      // The persisted taskFilter is later read back and forwarded verbatim into
      // the tasks publication's selector. Reject code-execution operators here
      // so a hostile filter can't be smuggled in via the persistence path.
      assertSafeSelector(filter);
      const user = await MembersCollection.findOneAsync(this.userId);
      if (!user) throw new Meteor.Error(404, 'User not found');
      const profile = { ...user.profile, taskFilter: filter };
      await MembersCollection.updateAsync({ _id: this.userId }, { $set: { profile } });
    },
    'members.options': async function () {
      validateUserId(this.userId);

      const hasPermission = await checkPermission(this.userId, 'members', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const squadScope = await getSquadScope(this.userId);
      const members = await MembersCollection.find(squadScope, { fields: { 'profile.rankId': 1, 'profile.id': 1, 'profile.name': 1 } }).fetchAsync();

      const rankIds = [...new Set(members.flatMap(m => m.profile?.rankId ? [m.profile.rankId] : []))];
      const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
      const rankNameById = new Map(ranks.map(r => [r._id, r.name]));

      const options = members.map(member => ({
        label: getFullName(rankNameById.get(member.profile?.rankId as string), member.profile?.id, member.profile?.name),
        value: member._id,
      }));

      return options;
    },
    'members.participantNames': async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);
      assertSafeSelector(filter);

      const hasPermission = await checkPermission(this.userId, 'members', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const squadScope = await getSquadScope(this.userId);
      const scopedFilter = { ...filter, ...squadScope };
      const members = await MembersCollection.find(scopedFilter, options).fetchAsync();

      const rankIds = [...new Set(members.flatMap(m => m.profile?.rankId ? [m.profile.rankId] : []))];
      const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
      const rankNameById = new Map(ranks.map(r => [r._id, r.name]));

      const names = members.map(member =>
        getFullName(rankNameById.get(member.profile?.rankId as string), member.profile?.id, member.profile?.name)
      );
      return names.join(', ');
    },
    'members.getUsedIds': async function () {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }

      const members = await MembersCollection.find({}, { fields: { 'profile.id': 1 } }).mapAsync(m => m.profile?.id);

      return members;
    },
    'members.getUsedNames': async function () {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }

      const members = await MembersCollection.find({}, { fields: { 'profile.name': 1 } }).mapAsync(m => m.profile?.name);

      return members;
    },
    // Returns true when `name` is free among members (excluding the member being
    // edited). An empty name is treated as available — the required-field rule
    // handles emptiness; this only checks uniqueness.
    'members.validateName': async function (name: string = '', excludeId: string | false = false): Promise<boolean> {
      validateUserId(this.userId);
      validateString(name, true);
      if (!name) return true;

      const filter: Record<string, unknown> = { 'profile.name': name };
      if (excludeId) {
        filter._id = { $ne: excludeId };
      }
      return !(await MembersCollection.findOneAsync(filter));
    },
    // Returns true when `id` is free among members (excluding the member being edited).
    'members.validateId': async function (id: number = 0, excludeId: string | false = false): Promise<boolean> {
      validateUserId(this.userId);
      validateNumber(id, true);
      if (!id) return true;

      const filter: Record<string, unknown> = { 'profile.id': id };
      if (excludeId) {
        filter._id = { $ne: excludeId };
      }
      return !(await MembersCollection.findOneAsync(filter));
    },
    'members.all': async function () {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }
      const hasPermission = await checkPermission(this.userId, 'members', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const squadScope = await getSquadScope(this.userId);
      // Strip the password-hash off every returned doc post-fetch — this path
      // fetched full member docs with no field projection (SEC-001, Critical).
      const members = await MembersCollection.find(squadScope).fetchAsync();
      return stripServicesFromAll(members);
    },
    'members.groupedOptions': async function () {
      validateUserId(this.userId);

      const members = await MembersCollection.find({}, { fields: { 'profile.rankId': 1, 'profile.id': 1, 'profile.name': 1, 'profile.squadId': 1 } }).fetchAsync();

      const rankIds = [...new Set(members.flatMap(m => m.profile?.rankId ? [m.profile.rankId] : []))];
      const squadIds = [...new Set(members.flatMap(m => m.profile?.squadId ? [m.profile.squadId] : []))];
      // Ranks and squads are independent lookups — race them via Promise.all
      // instead of waterfalling.
      const [ranks, squads] = await Promise.all([
        RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync(),
        SquadsCollection.find({ _id: { $in: squadIds } }).fetchAsync(),
      ]);
      const rankNameById = new Map(ranks.map(r => [r._id, r.name]));
      const squadNameById = new Map(squads.map(s => [s._id, s.name]));

      const groups: Record<string, { label: string; value: string }[]> = {};
      for (const member of members) {
        const squadName = member.profile?.squadId ? squadNameById.get(member.profile.squadId) || '-' : 'Unassigned';
        if (!groups[squadName]) groups[squadName] = [];
        groups[squadName].push({
          label: getFullName(rankNameById.get(member.profile?.rankId as string), member.profile?.id, member.profile?.name),
          value: member._id,
        });
      }

      return Object.entries(groups).map(([label, options]) => ({ label, options }));
    },
    'members.profileAccess': async function (targetUserId: string) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      const viewer = await MembersCollection.findOneAsync(this.userId);
      const viewerRole = await RolesCollection.findOneAsync({ _id: viewer?.profile?.roleId ?? null } as never);
      const viewerIsOfficerOrAdmin = (viewerRole as Role | undefined)?.roles === true;
      return { canViewContact: viewerIsOfficerOrAdmin || this.userId === targetUserId };
    },
    'members.attendanceBreakdown': async function (targetUserId?: string) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      const userId = targetUserId || this.userId;

      if (userId !== this.userId) {
        const hasPermission = await checkPermission(this.userId, 'members', 'read');
        if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
      }

      const now = dayjs();
      const quarterStart = now.startOf('quarter' as dayjs.OpUnitType).toDate();
      const total = { present: 0, absent: 0, excused: 0, zeus: 0, total: 0 };
      const quarterly = { present: 0, absent: 0, excused: 0, zeus: 0, total: 0 };
      let missionCount = 0;

      await AttendancesCollection.find({ [userId]: { $exists: true } }).forEachAsync(async attendance => {
        const val = (attendance as Record<string, unknown>)[userId] as number;
        if (val === -2) return;

        total.total += 1;
        if (val === 1) { total.present += 1; missionCount += 1; }
        else if (val === 2) { total.zeus += 1; missionCount += 1; }
        else if (val === -1) total.absent += 1;
        else if (val === 0) total.excused += 1;

        const event = await EventsCollection.findOneAsync({ _id: attendance.eventId as unknown as string });
        if (event && event.start >= quarterStart) {
          quarterly.total += 1;
          if (val === 1) quarterly.present += 1;
          else if (val === 2) quarterly.zeus += 1;
          else if (val === -1) quarterly.absent += 1;
          else if (val === 0) quarterly.excused += 1;
        }
      });

      return { total, quarterly, missionCount };
    },
    'members.profileStats': async function (userOrTargetId: Meteor.User | string | undefined, role?: Role) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      let user: Meteor.User | null | undefined = typeof userOrTargetId === 'object' ? userOrTargetId : undefined;

      if (typeof userOrTargetId === 'string') {
        if (userOrTargetId !== this.userId) {
          const hasPermission = await checkPermission(this.userId, 'members', 'read');
          if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

          const viewerRole = await getUserRole(this.userId);
          if (!isOfficerOrAdmin(viewerRole)) {
            const viewer = await MembersCollection.findOneAsync(this.userId);
            const target = await MembersCollection.findOneAsync(userOrTargetId);
            if (viewer?.profile?.squadId && target?.profile?.squadId !== viewer.profile.squadId) {
              throw new Meteor.Error(403, 'Cannot view profiles outside your squad');
            }
          }
        }
        user = await Meteor.users.findOneAsync(userOrTargetId);
      }

      if (!user) user = await Meteor.users.findOneAsync(this.userId);

      if (!user) throw new Meteor.Error(404, 'User not found');

      const roleId = user.profile?.roleId;
      if (!role) role = (await RolesCollection.findOneAsync({ _id: roleId ?? null } as never)) as Role | undefined;

      let inactivityPoints = user.profile?.staticInactivityPoints || 0;
      let attendancePoints = user.profile?.staticAttendancePoints || 0;
      const userIdKey = user._id;
      await AttendancesCollection.find({ [userIdKey]: { $exists: true } }).forEachAsync(attendance => {
        const val = (attendance as Record<string, unknown>)[userIdKey] as number;
        if (val === -2) return;
        if (val === -1) inactivityPoints += 1;
        attendancePoints += val === 2 ? 1 : (val || 0);
      });

      const resolvedRank = user.profile?.rankId ? await RanksCollection.findOneAsync({ _id: user.profile.rankId }) : null;
      const resolvedNavyRank = user.profile?.navyRankId ? await RanksCollection.findOneAsync({ _id: user.profile.navyRankId }) : null;
      const resolvedPosition = user.profile?.positionId ? await PositionsCollection.findOneAsync({ _id: user.profile.positionId }) : null;

      const result = {
        ['profile picture']: user.profile?.profilePictureId
          ? (await ProfilePicturesCollection.findOneAsync({ _id: user.profile.profilePictureId }))?.value
          : '-',
        squad: user.profile?.squadId ? (await SquadsCollection.findOneAsync({ _id: user.profile.squadId }))?.name : '-',
        role: role?.name || '-',
        ['entry date']: user.profile?.entryDate ? dayjs(user.profile.entryDate).format('YYYY-MM-DD') : '-',
        rank: resolvedRank?.name || '-',
        rankColor: resolvedRank?.color || null,
        navyRank: resolvedNavyRank?.name || '-',
        id: user.profile?.id || '-',
        name: user.profile?.name || '-',
        ['attendance points']: attendancePoints,
        ['inactivity points']: inactivityPoints,
        medals: user.profile?.medalIds?.length
          ? (await MedalsCollection.find({ _id: { $in: user.profile.medalIds } }).mapAsync(m => m.name)).join(', ')
          : '-',
        specializations: user.profile?.specializationIds?.length
          ? await SpecializationsCollection.find({ _id: { $in: user.profile.specializationIds } }).mapAsync(s => ({ name: s.name, linkToFile: s.linkToFile || null }))
          : [],
        description: user.profile?.description || '-',
        steamProfileLink: user.profile?.steamProfileLink || '',
        discordTag: user.profile?.discordTag || '',
        position: resolvedPosition?.name || '-',
        positionColor: resolvedPosition?.color || null,
      };

      return result;
    },
  });
}
