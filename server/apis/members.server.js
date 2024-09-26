import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import MembersCollection from '../../imports/api/collections/members.collection';

function extractProfileFromPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    console.warn('Invalid payload', payload);
    return {};
  }
  const profile = {};
  if (payload.profilePictureId && typeof payload.profilePictureId === 'string') {
    profile.profilePictureId = payload.profilePictureId;
  }
  if (payload.name && typeof payload.name === 'string') {
    profile.name = payload.name;
  }
  if (payload.id && typeof payload.id === 'number') {
    profile.id = payload.id;
  }
  if (payload.rankId && typeof payload.rankId === 'string') {
    profile.rankId = payload.rankId;
  }
  if (payload.specializationIds && Array.isArray(payload.specializationIds)) {
    profile.specializationIds = payload.specializationIds;
  }
  if (payload.roleId && typeof payload.roleId === 'string') {
    profile.roleId = payload.roleId;
  }
  if (payload.squadId && typeof payload.squadId === 'string') {
    profile.squadId = payload.squadId;
  }
  if (payload.discordTag && typeof payload.discordTag === 'string') {
    profile.discordTag = payload.discordTag;
  }
  if (payload.steamProfileLink && typeof payload.steamProfileLink === 'string') {
    profile.steamProfileLink = payload.steamProfileLink;
  }
  if (payload.description && typeof payload.description === 'string') {
    profile.description = payload.description;
  }
  return profile;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Meteor.Error('invalid-payload', 'Invalid payload', payload);
  }
}

function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Meteor.Error('invalid-user-id', 'Invalid user ID', userId);
  }
}

function validateMemberId(memberId) {
  if (!memberId || typeof memberId !== 'string') {
    throw new Meteor.Error('invalid-member-id', 'Invalid member ID', memberId);
  }
}

function validateMember(member) {
  if (!member || typeof member !== 'object') {
    throw new Meteor.Error('invalid-member', 'Invalid member', member);
  }
}

async function getMemberById(memberId) {
  validateMemberId(memberId);
  const member = await MembersCollection.findOneAsync(memberId);
  validateMember(member);
  return member;
}

if (Meteor.isServer) {
  Meteor.publish('members', function (filter = {}, options = {}) {
    if (!this.userId) {
      return [];
    } else {
      return MembersCollection.find(filter, { ...options, fields: { services: 0 } });
    }
  });

  Meteor.methods({
    'members.insert': async function (payload = {}) {
      validateUserId(this.userId);
      function prepareUser(payload) {
        validatePayload(payload);
        const { username, password } = payload;
        if (!username || typeof username !== 'string') {
          throw new Meteor.Error('invalid-username', 'Invalid username', username);
        }
        if (!password || typeof password !== 'string') {
          throw new Meteor.Error('invalid-password', 'Invalid password', password);
        }
        const profile = extractProfileFromPayload(payload);
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
        if (data.username && typeof data.username === 'string') {
          modifier.username = data.username;
        }
        Object.keys(profile).forEach(key => {
          modifier['profile.' + key] = profile[key];
        });
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
  });
}
