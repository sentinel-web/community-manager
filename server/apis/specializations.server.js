import { Meteor } from 'meteor/meteor';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';

if (Meteor.isServer) {
  Meteor.publish('specializations', function (filter = {}, options = {}) {
    if (!this.userId || typeof this.userId !== 'string') {
      throw new Meteor.Error('specializations', 'not-authorized', JSON.stringify(this.userId));
    }
    if (!filter || typeof filter !== 'object') {
      throw new Meteor.Error('specializations', 'Invalid filter', JSON.stringify(filter));
    }
    if (!options || typeof options !== 'object') {
      throw new Meteor.Error('specializations', 'Invalid options', JSON.stringify(options));
    }

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
      if (!this.userId) {
        throw new Meteor.Error('specializations.insert', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!name || typeof name !== 'string') {
        throw new Meteor.Error('specializations.insert', 'Invalid name', JSON.stringify(name));
      }
      if (typeof color !== 'string' && color != null) {
        throw new Meteor.Error('specializations.insert', 'Invalid color', JSON.stringify(color));
      }
      if (typeof description !== 'string' && description != null) {
        throw new Meteor.Error('specializations.insert', 'Invalid description', JSON.stringify(description));
      }
      if (typeof requiredRankId !== 'string' && requiredRankId != null) {
        throw new Meteor.Error('specializations.insert', 'Invalid requiredRankId', JSON.stringify(requiredRankId));
      }
      if (
        (!Array.isArray(requiredSpecializationIds) && requiredSpecializationIds != null) ||
        (Array.isArray(requiredSpecializationIds) && !requiredSpecializationIds.every(id => typeof id === 'string'))
      ) {
        throw new Meteor.Error('specializations.insert', 'Invalid requiredSpecializationIds', JSON.stringify(requiredSpecializationIds));
      }
      if (
        (!Array.isArray(instructors) && instructors != null) ||
        (Array.isArray(instructors) && !instructors.every(instructor => typeof instructor === 'string'))
      ) {
        throw new Meteor.Error('specializations.insert', 'Invalid instructors', JSON.stringify(instructors));
      }
      if (typeof linkToFile !== 'string' && linkToFile != null) {
        throw new Meteor.Error('specializations.insert', 'Invalid linkToFile', JSON.stringify(linkToFile));
      }
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
      if (!this.userId) {
        throw new Meteor.Error('specializations.update', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!specializationId || typeof specializationId !== 'string') {
        throw new Meteor.Error('specializations.update', 'Invalid specialization ID', JSON.stringify(specializationId));
      }
      if (!data || typeof data !== 'object') {
        throw new Meteor.Error('specializations.update', 'Invalid data', JSON.stringify(data));
      }
      const specialization = await SpecializationsCollection.findOneAsync(specializationId);
      if (!specialization) {
        throw new Meteor.Error('specializations.update', 'specialization-not-found', JSON.stringify(specializationId));
      }
      try {
        return await SpecializationsCollection.updateAsync({ _id: specializationId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'specializations.remove': async function (specializationId = '') {
      if (!this.userId) {
        throw new Meteor.Error('specializations.remove', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!specializationId || typeof specializationId !== 'string') {
        throw new Meteor.Error('specializations.remove', 'Invalid specialization ID', JSON.stringify(specializationId));
      }

      const specialization = await SpecializationsCollection.findOneAsync(specializationId);
      if (!specialization) {
        throw new Meteor.Error('specializations.remove', 'specialization-not-found', JSON.stringify(specializationId));
      }

      try {
        return await SpecializationsCollection.removeAsync({ _id: specializationId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'specializations.options': async function () {
      if (!this.userId) {
        throw new Meteor.Error('specializations.options', 'not-authorized', JSON.stringify(this.userId));
      }
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
      if (!this.userId) {
        throw new Meteor.Error('specializations.names', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!Array.isArray(specializations) || !specializations.every(id => typeof id === 'string')) {
        throw new Meteor.Error('specializations.names', 'Invalid specializations', JSON.stringify(specializations));
      }
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
