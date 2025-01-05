import ProfilePicturesCollection from '../../imports/api/collections/profilePictures.collection';
import { Meteor } from 'meteor/meteor';
import { validateObject, validatePublish } from '../main';

function validatePayload(payload) {
  validateObject(payload, true);
}

async function validateProfilePictureId(profilePictureId) {
  validateString(profilePictureId, true);
  const profilePicture = await ProfilePicturesCollection.findOneAsync({ _id: profilePictureId });
  validateObject(profilePicture, true);
}

if (Meteor.isServer) {
  Meteor.publish('profilePictures', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return ProfilePicturesCollection.find(filter, options);
  });

  Meteor.methods({
    'profilePictures.get': async function (profilePictureId = '') {
      validateUserId(this.userId);
      await validateProfilePictureId(profilePictureId);
      return await ProfilePicturesCollection.findOneAsync(profilePictureId);
    },
    'profilePictures.insert': async function (payload = {}) {
      validateUserId(this.userId);
      validatePayload(payload);
      try {
        return await ProfilePicturesCollection.insertAsync(payload);
      } catch (error) {
        throw new Meteor.Error('profilePictures.insert', error.message);
      }
    },
    'profilePictures.update': async function (profilePictureId = '', data = {}) {
      validateUserId(this.userId);
      validatePayload(data);
      await validateProfilePictureId(profilePictureId);
      try {
        return await ProfilePicturesCollection.updateAsync(profilePictureId, data);
      } catch (error) {
        throw new Meteor.Error('profilePictures.update', error.message);
      }
    },
    'profilePictures.remove': async function (profilePictureId = '') {
      validateUserId(this.userId);
      await validateProfilePictureId(profilePictureId);
      try {
        return await ProfilePicturesCollection.removeAsync(profilePictureId);
      } catch (error) {
        throw new Meteor.Error('profilePictures.remove', error.message);
      }
    },
  });
}
