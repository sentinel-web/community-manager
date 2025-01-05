import { Meteor } from 'meteor/meteor';
import SquadsCollection from '../../imports/api/collections/squads.collection';

if (Meteor.isServer) {
  Meteor.publish('squads', function (filter = {}, options = {}) {
    if (!this.userId || typeof this.userId !== 'string') {
      throw new Meteor.Error('squads', 'not-authorized', JSON.stringify(this.userId));
    }
    if (!filter || typeof filter !== 'object') {
      throw new Meteor.Error('squads', 'Invalid filter', JSON.stringify(filter));
    }
    if (!options || typeof options !== 'object') {
      throw new Meteor.Error('squads', 'Invalid options', JSON.stringify(options));
    }

    return SquadsCollection.find(filter, options);
  });

  Meteor.methods({
    'squads.insert': async function ({ name = '', description = '', image = '', color = '', shortRangeFrequency = '' } = {}) {
      if (!this.userId) {
        throw new Meteor.Error('squads.insert', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!name || typeof name !== 'string') {
        throw new Meteor.Error('squads.insert', 'Invalid name', JSON.stringify(name));
      }
      if (typeof color !== 'string' && color != null) {
        throw new Meteor.Error('squads.insert', 'Invalid color', JSON.stringify(color));
      }
      if (typeof description !== 'string' && description != null) {
        throw new Meteor.Error('squads.insert', 'Invalid description', JSON.stringify(description));
      }
      if (typeof image !== 'string' && image != null) {
        throw new Meteor.Error('squads.insert', 'Invalid image', JSON.stringify(image));
      }
      if (typeof shortRangeFrequency !== 'string' && shortRangeFrequency != null) {
        throw new Meteor.Error('squads.insert', 'Invalid shortRangeFrequency', JSON.stringify(shortRangeFrequency));
      }
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
      if (!this.userId) {
        throw new Meteor.Error('squads.update', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!squadId || typeof squadId !== 'string') {
        throw new Meteor.Error('squads.update', 'Invalid squad ID', JSON.stringify(squadId));
      }
      if (!data || typeof data !== 'object') {
        throw new Meteor.Error('squads.update', 'Invalid data', JSON.stringify(data));
      }
      const squad = await SquadsCollection.findOneAsync(squadId);
      if (!squad) {
        throw new Meteor.Error('squads.update', 'squad-not-found', JSON.stringify(squadId));
      }
      try {
        return await SquadsCollection.updateAsync({ _id: squadId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'squads.remove': async function (squadId = '') {
      if (!this.userId) {
        throw new Meteor.Error('squads.remove', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!squadId || typeof squadId !== 'string') {
        throw new Meteor.Error('squads.remove', 'Invalid squad ID', JSON.stringify(squadId));
      }

      const squad = await SquadsCollection.findOneAsync(squadId);
      if (!squad) {
        throw new Meteor.Error('squads.remove', 'squad-not-found', JSON.stringify(squadId));
      }

      try {
        return await SquadsCollection.removeAsync({ _id: squadId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'squads.options': async function () {
      if (!this.userId) {
        throw new Meteor.Error('squads.options', 'not-authorized', JSON.stringify(this.userId));
      }
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
