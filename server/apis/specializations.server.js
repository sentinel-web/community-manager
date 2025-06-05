import { Meteor } from 'meteor/meteor';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import { validateArrayOfStrings, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.methods({
    'specializations.names': async function (specializations = []) {
      validateUserId(this.userId);
      validateArrayOfStrings(specializations, false);
      try {
        const names = [];
        for (const specialization of specializations) {
          const foundSpecialization = await SpecializationsCollection.findOneAsync(specialization);
          if (foundSpecialization) {
            names.push(foundSpecialization.name);
          }
        }
        return names.join(', ');
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
