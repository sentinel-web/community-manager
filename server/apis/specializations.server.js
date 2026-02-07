import { Meteor } from 'meteor/meteor';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import { validateArrayOfStrings, validateString, validateUserId } from '../main';
import { createLog } from './logs.server';

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
    'specializations.request': async function (specializationId) {
      validateUserId(this.userId);
      validateString(specializationId, false);

      const spec = await SpecializationsCollection.findOneAsync(specializationId);
      if (!spec) throw new Meteor.Error(404, 'Specialization not found');

      await createLog('specialization.requested', {
        userId: this.userId,
        specializationId,
        specializationName: spec.name,
      });

      return true;
    },
  });
}
