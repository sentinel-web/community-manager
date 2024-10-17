import ProfilePicturesCollection from '../../imports/api/collections/profilePictures.collection';
import { Meteor } from 'meteor/meteor';

function validateUserId(userId) {
  if (!userId) {
    throw new Meteor.Error('Error in validateUserId', 'not-authorized');
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Meteor.Error('Error in validatePayload', 'Invalid payload', payload);
  }
}

async function validateProfilePictureId(profilePictureId) {
  if (!profilePictureId || typeof profilePictureId !== 'string') {
    throw new Meteor.Error('Error in validateProfilePictureId', 'Invalid type of profile picture ID', profilePictureId);
  }

  if (!(await ProfilePicturesCollection.findOneAsync({ _id: profilePictureId }))) {
    throw new Meteor.Error('Error in validateProfilePictureId', 'No profile picture ID found', profilePictureId);
  }
}

if (Meteor.isServer) {
  Meteor.publish('profilePictures', function (filter = {}, options = {}) {
    validateUserId(this.userId);
    return ProfilePicturesCollection.find(filter, options);
  });

  Meteor.methods({
    'profilePictures.get': async function (profilePictureId = '') {
      validateUserId(this.userId);
      await validateProfilePictureId(profilePictureId);
      try {
        const picture = await ProfilePicturesCollection.findOneAsync({ _id: profilePictureId });
        if (!picture) {
          throw new Meteor.Error('Error in profilePictures.get', 'No profile picture found');
        }
        return picture;
      } catch (error) {
        throw new Meteor.Error('Error in profilePictures.get', error.message);
      }
    },
    'profilePictures.insert': async function (payload = {}) {
      validateUserId(this.userId);
      validatePayload(payload);
      try {
        return await ProfilePicturesCollection.insertAsync(payload);
      } catch (error) {
        throw new Meteor.Error('Error in profilePictures.insert', error.message);
      }
    },
    'profilePictures.update': async function (profilePictureId = '', data = {}) {
      validateUserId(this.userId);
      validatePayload(data);
      await validateProfilePictureId(profilePictureId);
      try {
        return await ProfilePicturesCollection.updateAsync(profilePictureId, data);
      } catch (error) {
        throw new Meteor.Error('Error in profilePictures.update', error.message);
      }
    },
    'profilePictures.remove': async function (profilePictureId = '') {
      validateUserId(this.userId);
      await validateProfilePictureId(profilePictureId);
      try {
        return await ProfilePicturesCollection.removeAsync(profilePictureId);
      } catch (error) {
        throw new Meteor.Error('Error in profilePictures.remove', error.message);
      }
    },
  });
}
