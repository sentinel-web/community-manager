import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import { validateNumber } from '../main';

if (Meteor.isServer) {
  Meteor.methods({
    'registrations.validateId': async function (id: number = 0, excludeId: string | false = false): Promise<boolean> {
      validateNumber(id, false);

      const filter: Record<string, unknown> = { $and: [{ 'profile.id': id }] };
      if (this.userId && excludeId) {
        (filter.$and as Record<string, unknown>[]).push({ 'profile.id': { $ne: id } });
      }
      const matchingMembers = await MembersCollection.findOneAsync(filter);

      const registrationFilter: Record<string, unknown> = {
        $and: [{ id: id }],
      };
      if (this.userId && excludeId) {
        (registrationFilter.$and as Record<string, unknown>[]).push({ _id: { $ne: excludeId } });
      }
      const matchingRegistrations = await RegistrationsCollection.findOneAsync(registrationFilter);
      return !(matchingMembers || matchingRegistrations);
    },
    'registrations.validateName': async function (name: string = '', excludeId: string | false = false): Promise<boolean> {
      if (!name || typeof name !== 'string') {
        throw new Meteor.Error('invalid-name', 'Invalid name', name);
      }

      const filter: Record<string, unknown> = {
        $and: [{ 'profile.name': name }],
      };
      if (this.userId && excludeId) {
        (filter.$and as Record<string, unknown>[]).push({ 'profile.name': { $ne: name } });
      }
      const matchingMembers = await MembersCollection.findOneAsync(filter);

      const registrationFilter: Record<string, unknown> = {
        $and: [{ name: name }],
      };
      if (this.userId && excludeId) {
        (registrationFilter.$and as Record<string, unknown>[]).push({ _id: { $ne: excludeId } });
      }
      const matchingRegistrations = await RegistrationsCollection.findOneAsync(registrationFilter);
      return !(matchingMembers || matchingRegistrations);
    },
  });
}
