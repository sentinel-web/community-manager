import { Meteor } from 'meteor/meteor';
import RanksCollection from '../../imports/api/collections/ranks.collection';

if (Meteor.isServer) {
  Meteor.publish('ranks', function (filter = {}, options = {}) {
    if (!this.userId || typeof this.userId !== 'string') {
      throw new Meteor.Error('ranks', 'not-authorized', JSON.stringify(this.userId));
    }
    if (!filter || typeof filter !== 'object') {
      throw new Meteor.Error('ranks', 'Invalid filter', JSON.stringify(filter));
    }
    if (!options || typeof options !== 'object') {
      throw new Meteor.Error('ranks', 'Invalid options', JSON.stringify(options));
    }

    return RanksCollection.find(filter, options);
  });

  Meteor.methods({
    'ranks.insert': async function ({ name = '', color = '', description = '', previousRankId = '', nextRankId = '' } = {}) {
      if (!this.userId) {
        throw new Meteor.Error('ranks.insert', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!name || typeof name !== 'string') {
        throw new Meteor.Error('ranks.insert', 'Invalid name', JSON.stringify(name));
      }
      if (typeof color !== 'string' && color != null) {
        throw new Meteor.Error('ranks.insert', 'Invalid color', JSON.stringify(color));
      }
      if (typeof description !== 'string' && description != null) {
        throw new Meteor.Error('ranks.insert', 'Invalid description', JSON.stringify(description));
      }
      if (typeof previousRankId !== 'string' && previousRankId != null) {
        throw new Meteor.Error('ranks.insert', 'Invalid previousRankId', JSON.stringify(previousRankId));
      }
      if (typeof nextRankId !== 'string' && nextRankId != null) {
        throw new Meteor.Error('ranks.insert', 'Invalid nextRankId', JSON.stringify(nextRankId));
      }
      try {
        return await RanksCollection.insertAsync({ name, color, description, previousRankId, nextRankId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'ranks.update': async function (rankId = '', data = {}) {
      if (!rankId || typeof rankId !== 'string') {
        throw new Meteor.Error('ranks.update', 'Invalid rank ID', JSON.stringify(rankId));
      }
      if (!data || typeof data !== 'object') {
        throw new Meteor.Error('ranks.update', 'Invalid data', JSON.stringify(data));
      }
      if (!this.userId) {
        throw new Meteor.Error('ranks.update', 'not-authorized', JSON.stringify(this.userId));
      }
      const rank = await RanksCollection.findOneAsync(rankId);
      if (!rank) {
        throw new Meteor.Error('ranks.update', 'rank-not-found', JSON.stringify(rankId));
      }
      try {
        return await RanksCollection.updateAsync({ _id: rankId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'ranks.remove': async function (rankId = '') {
      if (!this.userId) {
        throw new Meteor.Error('ranks.remove', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!rankId || typeof rankId !== 'string') {
        throw new Meteor.Error('ranks.remove', 'Invalid rank ID', JSON.stringify(rankId));
      }

      const rank = await RanksCollection.findOneAsync(rankId);
      if (!rank) {
        throw new Meteor.Error('ranks.remove', 'ranks-not-found', JSON.stringify(rankId));
      }

      try {
        return await RanksCollection.removeAsync({ _id: rankId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'ranks.options': async function () {
      if (!this.userId) {
        throw new Meteor.Error('ranks.options', 'not-authorized', JSON.stringify(this.userId));
      }
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
