import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import { validateObject, validatePublish, validateString, validateUserId } from '../main';

function extractProfileFromPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    console.warn('Invalid payload', payload);
    return {};
  }
  const profile = {};
  profile.profilePictureId = payload.profilePictureId === null ? null : payload.profilePictureId;
  profile.name = payload.name === null ? null : payload.name;
  profile.id = payload.id === null ? null : payload.id;
  profile.rankId = payload.rankId === null ? null : payload.rankId;
  profile.navyRankId = payload.navyRankId === null ? null : payload.navyRankId;
  profile.specializationIds = payload.specializationIds === null ? null : payload.specializationIds;
  profile.roleId = payload.roleId === null ? null : payload.roleId;
  profile.squadId = payload.squadId === null ? null : payload.squadId;
  profile.discordTag = payload.discordTag === null ? null : payload.discordTag;
  profile.steamProfileLink = payload.steamProfileLink === null ? null : payload.steamProfileLink;
  profile.staticAttendencePoints = payload.staticAttendencePoints === null ? null : payload.staticAttendencePoints;
  profile.medalIds = payload.medalIds === null ? null : payload.medalIds;
  profile.entryDate = payload.entryDate === null ? null : payload.entryDate;
  profile.exitDate = payload.exitDate === null ? null : payload.exitDate;
  profile.hasCustomArmour = payload.hasCustomArmour === null ? null : payload.hasCustomArmour;
  profile.description = payload.description === null ? null : payload.description;
  profile.taskFilter = payload.taskFilter || undefined;
  return profile;
}

function validatePayload(payload) {
  validateObject(payload, false);
}

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
  Meteor.publish('members', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return MembersCollection.find(filter, { ...options, fields: { services: 0 } });
  });

  Meteor.methods({
    'members.insert': async function (payload = {}) {
      validateUserId(this.userId);
      function prepareUser(payload) {
        validatePayload(payload);
        const { username, password } = payload;
        validateString(username, false);
        validateString(password, false);
        const profile = extractProfileFromPayload(payload) || {};
        const user = {
          username,
          password,
          profile,
        };
        return user;
      }
      try {
        return await Accounts.createUserAsync(prepareUser(payload));
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'members.update': async function (memberId = '', data = {}) {
      validateUserId(this.userId);
      function buildModifier(data) {
        validatePayload(data);
        const modifier = {};
        const profile = extractProfileFromPayload(data);
        if (data.username !== undefined || typeof data.username === 'string') {
          modifier.username = data.username;
        }
        for (const [key, value] of Object.entries(profile)) {
          modifier[`profile.${key}`] = value;
        }
        return {
          $set: modifier,
        };
      }
      await getMemberById(memberId);
      const selector = { _id: memberId };
      const modifier = buildModifier(data);
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
  });
}
