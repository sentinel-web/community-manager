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
  profile.profilePictureId = payload.profilePictureId || null;
  profile.name = payload.name || null;
  profile.id = payload.id || null;
  profile.rankId = payload.rankId || null;
  profile.navyRankId = payload.navyRankId || null;
  profile.specializationIds = payload.specializationIds || null;
  profile.roleId = payload.roleId || null;
  profile.squadId = payload.squadId || null;
  profile.discordTag = payload.discordTag || null;
  profile.steamProfileLink = payload.steamProfileLink || null;
  profile.medalIds = payload.medalIds || null;
  profile.entryDate = payload.entryDate || null;
  profile.exitDate = payload.exitDate || null;
  profile.hasCustomArmour = payload.hasCustomArmour || null;
  profile.description = payload.description || null;
  profile.taskFilter = payload.taskFilter || null;
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
  validateString(rankId, false);
  const rank = await RanksCollection.findOneAsync({ _id: rankId });
  validateObject(rank, false);
  return rank.name || '-';
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
