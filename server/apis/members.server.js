import dayjs from 'dayjs';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import EventsCollection from '../../imports/api/collections/events.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import ProfilePicturesCollection from '../../imports/api/collections/profilePictures.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { validateObject, validatePublish, validateUserId, checkPermission, checkSpecialPermission, getSquadScope, isOfficerOrAdmin, getUserRole } from '../main';
import { createLog } from './logs.server';

async function getMemberById(memberId) {
  validateUserId(memberId);
  const member = await MembersCollection.findOneAsync(memberId);
  validateObject(member, false);
  return member;
}

const getRankName = async rankId => {
  const rank = await RanksCollection.findOneAsync({ _id: rankId || null });
  return rank?.name;
};

const getFullName = (rank, id, name) => {
  return `${rank || 'Unranked'}-${id || '0000'} ${name || 'Name'}`;
};

if (Meteor.isServer) {
  Meteor.publish('user', function () {
    validateUserId(this.userId);
    return MembersCollection.find({ _id: this.userId }, { fields: { services: 0 } });
  });
  Meteor.publish('members', async function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    const squadScope = await getSquadScope(this.userId);
    const scopedFilter = { ...filter, ...squadScope };
    return MembersCollection.find(scopedFilter, { ...options, fields: { services: 0 } });
  });

  Meteor.methods({
    'members.read': async function (filter = {}, options = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);

      // Check read permission
      const hasPermission = await checkPermission(this.userId, 'members', 'read');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      const squadScope = await getSquadScope(this.userId);
      const scopedFilter = { ...filter, ...squadScope };
      return await MembersCollection.find(scopedFilter, options).fetchAsync();
    },
    'members.findOne': async function (filter = {}, options = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);
      const member = await MembersCollection.findOneAsync(filter, options);
      if (!member) throw new Meteor.Error(404, 'Member not found');
      return member;
    },
    'members.insert': async function (payload = {}) {
      validateUserId(this.userId);
      validateObject(payload);

      // Check create permission
      const hasPermission = await checkPermission(this.userId, 'members', 'create');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      try {
        const memberId = await Accounts.createUserAsync(payload);
        await createLog('member.created', {
          id: memberId,
          username: payload.username,
        });
        return memberId;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'members.update': async function (memberId = '', data = {}) {
      validateUserId(this.userId);
      const targetMember = await getMemberById(memberId);

      // Check update permission
      const hasPermission = await checkPermission(this.userId, 'members', 'update');
      if (!hasPermission) {
        // Allow instructors to update specializations only
        const isSpecOnly = data['profile.specializationIds'] && Object.keys(data).length === 1;
        const canManageSpecs = isSpecOnly && (await checkSpecialPermission(this.userId, 'canManageSpecializations'));
        if (!canManageSpecs) throw new Meteor.Error(403, 'Permission denied');
      }

      // Squad scope check: non-officers can only update members in same squad
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
        const result = await MembersCollection.updateAsync(selector, modifier);
        await createLog('member.updated', {
          id: memberId,
          changes: data,
        });
        return result;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'members.remove': async function (memberId = '') {
      validateUserId(this.userId);
      await getMemberById(memberId);

      // Check delete permission
      const hasPermission = await checkPermission(this.userId, 'members', 'delete');
      if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

      try {
        const result = await MembersCollection.removeAsync({ _id: memberId });
        await createLog('member.deleted', { id: memberId });
        return result;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'members.options': async function () {
      validateUserId(this.userId);

      const members = await MembersCollection.find({}, { fields: { 'profile.rankId': 1, 'profile.id': 1, 'profile.name': 1 } }).fetchAsync();

      // Batch load all ranks to avoid N+1 queries
      const rankIds = [...new Set(members.map(m => m.profile?.rankId).filter(Boolean))];
      const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
      const rankNameById = new Map(ranks.map(r => [r._id, r.name]));

      const options = members.map(member => ({
        label: getFullName(rankNameById.get(member.profile?.rankId), member.profile?.id, member.profile?.name),
        value: member._id,
      }));

      return options;
    },
    'members.participantNames': async function (filter = {}, options = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);
      try {
        const members = await MembersCollection.find(filter, options).fetchAsync();

        // Batch load all ranks to avoid N+1 queries
        const rankIds = [...new Set(members.map(m => m.profile?.rankId).filter(Boolean))];
        const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
        const rankNameById = new Map(ranks.map(r => [r._id, r.name]));

        const names = members.map(member =>
          getFullName(rankNameById.get(member.profile?.rankId), member.profile?.id, member.profile?.name)
        );
        return names.join(', ');
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'members.getUsedIds': async function () {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }

      const members = await MembersCollection.find({}, { fields: { 'profile.id': 1 } }).mapAsync(m => m.profile.id);

      return members;
    },
    'members.getUsedNames': async function () {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }

      const members = await MembersCollection.find({}, { fields: { 'profile.name': 1 } }).mapAsync(m => m.profile.name);

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

      // Batch load ranks and squads
      const rankIds = [...new Set(members.map(m => m.profile?.rankId).filter(Boolean))];
      const squadIds = [...new Set(members.map(m => m.profile?.squadId).filter(Boolean))];
      const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync();
      const squads = await SquadsCollection.find({ _id: { $in: squadIds } }).fetchAsync();
      const rankNameById = new Map(ranks.map(r => [r._id, r.name]));
      const squadNameById = new Map(squads.map(s => [s._id, s.name]));

      const groups = {};
      for (const member of members) {
        const squadName = member.profile?.squadId ? squadNameById.get(member.profile.squadId) || '-' : 'Unassigned';
        if (!groups[squadName]) groups[squadName] = [];
        groups[squadName].push({
          label: getFullName(rankNameById.get(member.profile?.rankId), member.profile?.id, member.profile?.name),
          value: member._id,
        });
      }

      return Object.entries(groups).map(([label, options]) => ({ label, options }));
    },
    'members.profileAccess': async function (targetUserId) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      const viewerRole = await RolesCollection.findOneAsync({ _id: (await MembersCollection.findOneAsync(this.userId))?.profile?.roleId ?? null });
      const isOfficerOrAdmin = viewerRole?.roles === true;
      return { canViewContact: isOfficerOrAdmin || this.userId === targetUserId };
    },
    'members.attendanceBreakdown': async function (targetUserId) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');
      const userId = targetUserId || this.userId;

      if (userId !== this.userId) {
        const hasPermission = await checkPermission(this.userId, 'members', 'read');
        if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
      }

      const now = dayjs();
      const quarterStart = now.startOf('quarter').toDate();
      const total = { present: 0, absent: 0, excused: 0, zeus: 0, total: 0 };
      const quarterly = { present: 0, absent: 0, excused: 0, zeus: 0, total: 0 };
      let missionCount = 0;

      await AttendancesCollection.find({ [userId]: { $exists: true } }).forEachAsync(async attendance => {
        const val = attendance[userId];
        if (val === -2) return; // skip cancelled

        total.total += 1;
        if (val === 1) { total.present += 1; missionCount += 1; }
        else if (val === 2) { total.zeus += 1; missionCount += 1; }
        else if (val === -1) total.absent += 1;
        else if (val === 0) total.excused += 1;

        // Check if event is in current quarter
        const event = await EventsCollection.findOneAsync({ _id: attendance.eventId });
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
    'members.profileStats': async function (userOrTargetId, role) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      let user = userOrTargetId;
      // Support passing a targetUserId string
      if (typeof userOrTargetId === 'string') {
        if (userOrTargetId !== this.userId) {
          const hasPermission = await checkPermission(this.userId, 'members', 'read');
          if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');

          // Squad scope check
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
      if (!role) role = await RolesCollection.findOneAsync({ _id: roleId ?? null });

      let inactivityPoints = user.profile?.staticInactivityPoints || 0;
      let attendancePoints = user.profile?.staticAttendancePoints || 0;
      await AttendancesCollection.find({ [user._id]: { $exists: true } }).forEachAsync(attendance => {
        const val = attendance[user._id];
        if (val === -2) return; // skip cancelled events
        if (val === -1) inactivityPoints += 1;
        attendancePoints += val === 2 ? 1 : (val || 0);
      });

      const resolvedRank = user.profile?.rankId ? await RanksCollection.findOneAsync({ _id: user.profile.rankId }) : null;
      const resolvedNavyRank = user.profile?.navyRankId ? await RanksCollection.findOneAsync({ _id: user.profile.navyRankId }) : null;

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
        position: user.profile?.position || '-',
      };

      return result;
    },
  });
}
