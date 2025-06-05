import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import { validateNumber } from '../main';

if (Meteor.isServer) {
  Meteor.methods({
    'registrations.validateId': async function (id = '', excludeId = false) {
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
