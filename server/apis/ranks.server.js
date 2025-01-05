import { Meteor } from 'meteor/meteor';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import { validateObject, validatePublish, validateString, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('ranks', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return RanksCollection.find(filter, options);
  });

  Meteor.methods({
    'ranks.insert': async function ({ name = '', color = '', description = '', previousRankId = '', nextRankId = '' } = {}) {
      validateUserId(this.userId);
      validateString(name, true);
      validateString(color, false);
      validateString(description, false);
      validateString(previousRankId, false);
      validateString(nextRankId, false);
      try {
        return await RanksCollection.insertAsync({ name, color, description, previousRankId, nextRankId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'ranks.update': async function (rankId = '', data = {}) {
      validateUserId(this.userId);
      validateString(rankId, true);
      validateObject(data, true);
      const rank = await RanksCollection.findOneAsync(rankId);
      validateObject(rank, true);
      try {
        return await RanksCollection.updateAsync({ _id: rankId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'ranks.remove': async function (rankId = '') {
      validateUserId(this.userId);
      validateString(rankId, true);
      const rank = await RanksCollection.findOneAsync(rankId);
      validateObject(rank, true);
      try {
        return await RanksCollection.removeAsync({ _id: rankId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'ranks.options': async function () {
      validateUserId(this.userId);
      try {
        const ranks = await RanksCollection.find({}).fetchAsync();
        const options = [];
        for (const rank of ranks) {
          options.push({
            label: rank.name,
            value: rank._id,
            title: rank.description,
            raw: rank,
          });
        }
        return options;
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
