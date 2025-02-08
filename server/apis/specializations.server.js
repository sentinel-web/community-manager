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
      validateString(name, false);
      validateString(color, true);
      validateString(description, true);
      validateString(requiredRankId, true);
      validateArrayOfStrings(requiredSpecializationIds, true);
      validateArrayOfStrings(instructors, true);
      validateString(linkToFile, true);
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
      validateString(specializationId, false);
      validateObject(data, false);
      const specialization = await SpecializationsCollection.findOneAsync(specializationId);
      validateObject(specialization, false);
      try {
        return await SpecializationsCollection.updateAsync({ _id: specializationId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'specializations.remove': async function (specializationId = '') {
      validateUserId(this.userId);
      validateString(specializationId, false);
      const specialization = await SpecializationsCollection.findOneAsync(specializationId);
      validateObject(specialization, false);
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
