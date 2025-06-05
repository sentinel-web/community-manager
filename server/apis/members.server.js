import dayjs from 'dayjs';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../../imports/api/collections/attendances.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import ProfilePicturesCollection from '../../imports/api/collections/profilePictures.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { validateObject, validatePublish, validateUserId } from '../main';

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
  Meteor.publish('members', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return MembersCollection.find(filter, { ...options, fields: { services: 0 } });
  });

  Meteor.methods({
    'members.read': async function (filter = {}, options = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);
      return await MembersCollection.find(filter, options).fetchAsync();
    },
    'members.findOne': async function (filter = {}, options = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);
      return await MembersCollection.findOneAsync(filter, options);
    },
    'members.insert': async function (payload = {}) {
      validateUserId(this.userId);
      validateObject(payload);
      try {
        return await Accounts.createUserAsync(payload);
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'members.update': async function (memberId = '', data = {}) {
      validateUserId(this.userId);
      await getMemberById(memberId);
      const selector = { _id: memberId };
      const modifier = { $set: data };
      try {
        return await MembersCollection.updateAsync(selector, modifier);
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'members.remove': async function (memberId = '') {
      validateUserId(this.userId);
      await getMemberById(memberId);
      try {
        return await MembersCollection.removeAsync({ _id: memberId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'members.options': async function () {
      validateUserId(this.userId);

      const members = await MembersCollection.find({}, { fields: { 'profile.rankId': 1, 'profile.id': 1, 'profile.name': 1 } }).fetchAsync();

      const options = [];

      for (const member of members) {
        const rankName = await getRankName(member.profile?.rankId);
        options.push({
          label: getFullName(rankName, member.profile?.id, member.profile?.name),
          value: member._id,
        });
      }

      return options;
    },
    'members.participantNames': async function (filter = {}, options = {}) {
      validateUserId(this.userId);
      validateObject(filter, false);
      validateObject(options, false);
      try {
        const members = await MembersCollection.find(filter, options).fetchAsync();
        const names = [];
        for (const member of members) {
          const rankName = await getRankName(member.profile?.rankId);
          names.push(getFullName(rankName, member.profile?.id, member.profile?.name));
        }
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
    'members.profileStats': async function (user, role) {
      if (!this.userId) throw new Meteor.Error(401, 'Unauthorized');

      if (!user) user = await Meteor.users.findOneAsync(this.userId);

      if (!user) throw new Meteor.Error(404, 'User not found');

      const roleId = user.profile?.roleId;
      if (!role) role = await RolesCollection.findOneAsync({ _id: roleId ?? null });

      let inactivityPoints = user.profile?.staticInactivityPoints || 0;
      let attendancePoints = user.profile?.staticAttendancePoints || 0;
      await AttendancesCollection.find().forEachAsync(attendance => {
        if (attendance[user._id] === -1) {
          inactivityPoints += 1;
        }
        attendancePoints += attendance[user._id] || 0;
      });

      const result = {
        ['profile picture']: user.profile?.profilePictureId
          ? (await ProfilePicturesCollection.findOneAsync({ _id: user.profile.profilePictureId }))?.value
          : '-',
        squad: user.profile?.squadId ? (await SquadsCollection.findOneAsync({ _id: user.profile.squadId }))?.name : '-',
        role: role?.name || '-',
        ['entry date']: user.profile?.entryDate ? dayjs(user.profile.entryDate).format('YYYY-MM-DD') : '-',
        rank: user.profile?.rankId
          ? (await RanksCollection.findOneAsync({ _id: user.profile.rankId }))?.name ??
            (user.profile.navyRankId ? (await RanksCollection.findOneAsync({ _id: user.profile.navyRankId }))?.name : '-')
          : '-',
        id: user.profile?.id || '-',
        name: user.profile?.name || '-',
        ['attendance points']: attendancePoints,
        ['inactivity points']: inactivityPoints,
        medals: user.profile?.medalIds?.length
          ? (await MedalsCollection.find({ _id: { $in: user.profile.medalIds } }).mapAsync(m => m.name)).join(', ')
          : '-',
        specializations: user.profile?.specializationIds?.length
          ? (await SpecializationsCollection.find({ _id: { $in: user.profile.specializationIds } }).mapAsync(s => s.name)).join(', ')
          : '-',
        description: user.profile?.description || '-',
      };

      return result;
    },
  });
}
