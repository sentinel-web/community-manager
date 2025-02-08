import { Meteor } from 'meteor/meteor';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { validateObject, validatePublish, validateString, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('squads', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return SquadsCollection.find(filter, options);
  });

  Meteor.methods({
    'squads.insert': async function ({ name = '', description = '', image = '', color = '', shortRangeFrequency = '' } = {}) {
      validateUserId(this.userId);
      validateString(name, false);
      validateString(color, true);
      validateString(description, true);
      validateString(image, true);
      validateString(shortRangeFrequency, true);
      try {
        return await SquadsCollection.insertAsync({
          name,
          color,
          description,
          image,
          shortRangeFrequency,
        });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'squads.update': async function (squadId = '', data = {}) {
      validateUserId(this.userId);
      validateString(squadId, false);
      validateObject(data, false);
      const squad = await SquadsCollection.findOneAsync(squadId);
      validateObject(squad, false);
      try {
        return await SquadsCollection.updateAsync({ _id: squadId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'squads.remove': async function (squadId = '') {
      validateUserId(this.userId);
      validateString(squadId, false);
      const squad = await SquadsCollection.findOneAsync(squadId);
      validateObject(squad, false);
      try {
        return await SquadsCollection.removeAsync({ _id: squadId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'squads.options': async function () {
      validateUserId(this.userId);
      try {
        const squads = await SquadsCollection.find({}).fetchAsync();
        const options = [];
        for (const squad of squads) {
          options.push({
            label: squad.name,
            value: squad._id,
            title: squad.description,
            raw: squad,
          });
        }
        return options;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
