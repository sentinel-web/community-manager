import { Meteor } from 'meteor/meteor';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import { validateNumber, validateObject, validatePublish, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('registrations', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return RegistrationsCollection.find(filter, options);
  });

  Meteor.methods({
    'registrations.insert': async (payload = {}) => {
      validateUserId(this.userId);
      validateObject(payload, false);
      try {
        return await RegistrationsCollection.insertAsync(payload);
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'registrations.update': async function (registrationId = '', data = {}) {
      validateUserId(this.userId);
      validateString(registrationId, false);
      validateObject(data, false);
      const registration = await RegistrationsCollection.findOneAsync(registrationId);
      validateObject(registration, false);
      try {
        return await RegistrationsCollection.updateAsync({ _id: registrationId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'registrations.remove': async function (registrationId = '') {
      validateUserId(this.userId);
      validateString(registrationId, false);
      const registration = await RegistrationsCollection.findOneAsync(registrationId);
      validateObject(registration, false);
      try {
        return await RegistrationsCollection.removeAsync({
          _id: registrationId,
        });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'registrations.validateId': async function (id = '', excludeId = false) {
      validateUserId(this.userId);
      validateNumber(id, false);

      const filter = { $and: [{ 'profile.id': id }] };
      if (this.userId && excludeId) {
        filter.$and.push({ 'profile.id': { $ne: id } });
      }
      const matchingMembers = await MembersCollection.findOneAsync(filter);

      const registrationFilter = {
        $and: [{ id: id }],
      };
      if (this.userId && excludeId) {
        registrationFilter.$and.push({ _id: { $ne: excludeId } });
      }
      const matchingRegistrations = await RegistrationsCollection.findOneAsync(registrationFilter);
      return !(matchingMembers || matchingRegistrations);
    },
    'registrations.validateName': async function (name = '', excludeid = false) {
      if (!name || typeof name !== 'string') {
        throw new Meteor.Error('invalid-name', 'Invalid name', name);
      }

      const filter = {
        $and: [{ 'profile.name': name }],
      };
      if (this.userId && excludeid) {
        filter.$and.push({ 'profile.name': { $ne: name } });
      }
      const matchingMembers = await MembersCollection.findOneAsync(filter);

      const registrationFilter = {
        $and: [{ name: name }],
      };
      if (this.userId && excludeid) {
        registrationFilter.$and.push({ _id: { $ne: excludeid } });
      }
      const matchingRegistrations = await RegistrationsCollection.findOneAsync(registrationFilter);
      return !(matchingMembers || matchingRegistrations);
    },
  });
}
