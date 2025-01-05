import { Meteor } from 'meteor/meteor';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import { validateArrayOfStrings, validateObject, validatePublish, validateString, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('specializations', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return SpecializationsCollection.find(filter, options);
  });

  Meteor.methods({
    'specializations.insert': async function ({
      name = '',
      color = '',
      description = '',
      requiredRankId = '',
      requiredSpecializationIds = [],
      instructors = [],
      linkToFile = '',
    } = {}) {
      validateUserId(this.userId);
      validateString(name, true);
      validateString(color, false);
      validateString(description, false);
      validateString(requiredRankId, false);
      validateArrayOfStrings(requiredSpecializationIds, false);
      validateArrayOfStrings(instructors, false);
      validateString(linkToFile, false);
      try {
        return await SpecializationsCollection.insertAsync({
          name,
          color,
          description,
          requiredRankId,
          requiredSpecializationIds,
          instructors,
          linkToFile,
        });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'specializations.update': async function (specializationId = '', data = {}) {
      validateUserId(this.userId);
      validateString(specializationId, true);
      validateObject(data, true);
      const specialization = await SpecializationsCollection.findOneAsync(specializationId);
      validateObject(specialization, true);
      try {
        return await SpecializationsCollection.updateAsync({ _id: specializationId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'specializations.remove': async function (specializationId = '') {
      validateUserId(this.userId);
      validateString(specializationId, true);
      const specialization = await SpecializationsCollection.findOneAsync(specializationId);
      validateObject(specialization, true);
      try {
        return await SpecializationsCollection.removeAsync({ _id: specializationId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'specializations.options': async function () {
      validateUserId(this.userId);
      try {
        const specializations = await SpecializationsCollection.find({}).fetchAsync();
        const options = [];
        for (const specialization of specializations) {
          options.push({
            label: specialization.name,
            value: specialization._id,
            title: specialization.description,
            raw: specialization,
          });
        }
        return options;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'specializations.names': async function (specializations = []) {
      validateUserId(this.userId);
      validateArrayOfStrings(specializations, true);
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
