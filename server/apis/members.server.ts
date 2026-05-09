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
import { validateObject, validatePublish, validateUserId, checkPermission, checkSpecialPermission, getSquadScope, isOfficerOrAdmin, getUserRole } from '../main';
import { createLog } from './logs.server';
import type { Role } from '/imports/api/types';

async function getMemberById(memberId: string): Promise<Meteor.User> {
  validateUserId(memberId);
  const member = await MembersCollection.findOneAsync(memberId);
  validateObject(member, false);
  return member as Meteor.User;
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
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);

      const hasPermission = await checkPermission(this.userId, 'members', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const squadScope = await getSquadScope(this.userId);
      const scopedFilter = { ...filter, ...squadScope };
      return await MembersCollection.find(scopedFilter, options).fetchAsync();
    },
    'members.findOne': async function (filter: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);
      const member = await MembersCollection.findOneAsync(filter, options);
      if (!member) throw new Meteor.Error(404, 'Member not found');
      return member;
    },
    'members.insert': async function (payload: Record<string, unknown> = {}): Promise<string> {
      validateUserId(this.userId);
      validateObject(payload, false);

      const hasPermission = await checkPermission(this.userId, 'members', 'create');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      try {
        const memberId = await Accounts.createUserAsync(payload as Parameters<typeof Accounts.createUserAsync>[0]);
        await createLog('members.created', {
          id: memberId,
          username: payload.username,
        });
        return memberId;
      } catch (error) {
        throw new Meteor.Error((error as Error).message);
      }
    },
    'members.update': async function (memberId: string = '', data: Record<string, unknown> = {}) {
      validateUserId(this.userId);
      const targetMember = await getMemberById(memberId);

      const hasPermission = await checkPermission(this.userId, 'members', 'update');
      if (!hasPermission) {
        const isSpecOnly = data['profile.specializationIds'] && Object.keys(data).length === 1;
        const canManageSpecs = isSpecOnly && (await checkSpecialPermission(this.userId, 'canManageSpecializations'));
        if (!canManageSpecs) throw new Meteor.Error(403, 'Permission denied');
      }

      const role = await getUserRole(this.userId);
      if (!isOfficerOrAdmin(role)) {
        const viewer = await MembersCollection.findOneAsync(this.userId);
        if (viewer?.profile?.squadId && targetMember?.profile?.squadId !== viewer.profile.squadId) {
          throw new Meteor.Error(403, 'Cannot update members outside your squad');
        }
      }

      const selector = { _id: memberId };
      const modifier = { $set: data };
      try {
        const result = await MembersCollection.updateAsync(selector as never, modifier as never);
        await createLog('members.updated', {
          id: memberId,
          changes: data,
        });
        return result;
      } catch (error) {
        throw new Meteor.Error((error as Error).message);
      }
    },
    'members.remove': async function (memberId: string = '') {
      validateUserId(this.userId);
      await getMemberById(memberId);

      const hasPermission = await checkPermission(this.userId, 'members', 'delete');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      try {
        const result = await MembersCollection.removeAsync({ _id: memberId } as never);
        await createLog('members.deleted', { id: memberId });
        return result;
      } catch (error) {
        throw new Meteor.Error((error as Error).message);
      }
    },
    'members.saveTaskFilter': async function (filter: Record<string, unknown> = {}) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      validateObject(filter, false);
      const user = await MembersCollection.findOneAsync(this.userId);
      if (!user) throw new Meteor.Error(404, 'User not found');
      const profile = { ...user.profile, taskFilter: filter };
      await MembersCollection.updateAsync({ _id: this.userId }, { $set: { profile } });
    },
    'members.options': async function () {
      validateUserId(this.userId);

      const members = await MembersCollection.find({}, { fields: { 'profile.rankId': 1, 'profile.id': 1, 'profile.name': 1 } }).fetchAsync();

      const rankIds = [...new Set(members.map(m => m.profile?.rankId).filter((x): x is string => Boolean(x)))];
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
      try {
        const members = await MembersCollection.find(filter, options).fetchAsync();

        const rankIds = [...new Set(members.map(m => m.profile?.rankId).filter((x): x is string => Boolean(x)))];
        const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
        const rankNameById = new Map(ranks.map(r => [r._id, r.name]));

        const names = members.map(member =>
          getFullName(rankNameById.get(member.profile?.rankId as string), member.profile?.id, member.profile?.name)
        );
        return names.join(', ');
      } catch (error) {
        throw new Meteor.Error((error as Error).message);
      }
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
    'members.all': async function () {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }
      const members = await MembersCollection.find({}).fetchAsync();
      return members;
    },
    'members.groupedOptions': async function () {
      validateUserId(this.userId);

      const members = await MembersCollection.find({}, { fields: { 'profile.rankId': 1, 'profile.id': 1, 'profile.name': 1, 'profile.squadId': 1 } }).fetchAsync();

      const rankIds = [...new Set(members.map(m => m.profile?.rankId).filter((x): x is string => Boolean(x)))];
      const squadIds = [...new Set(members.map(m => m.profile?.squadId).filter((x): x is string => Boolean(x)))];
      const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
      const squads = await SquadsCollection.find({ _id: { $in: squadIds } }).fetchAsync();
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
