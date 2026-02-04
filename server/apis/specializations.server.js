import { Meteor } from 'meteor/meteor';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import { validateArrayOfStrings, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.methods({
    'specializations.names': async function (specializations = []) {
      validateUserId(this.userId);
      validateArrayOfStrings(specializations, false);
      try {
        // Use batch query instead of N+1 individual queries
        const foundSpecializations = await SpecializationsCollection.find({ _id: { $in: specializations } }).fetchAsync();
        const names = foundSpecializations.map(s => s.name);
        return names.join(', ');
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
