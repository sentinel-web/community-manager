import { Meteor } from 'meteor/meteor';
import DiscoveryTypesCollection from '../../imports/api/collections/discoveryTypes.collection';
import { validateObject, validateString, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('discoveryTypes', (filter = {}, options = {}) => {
    validateObject(options, false);
    validateObject(filter, false);
    return DiscoveryTypesCollection.find(filter, options);
  });

  Meteor.methods({
    'discoveryTypes.insert': async function ({ name = '', color = '', description = '' } = {}) {
      validateUserId(this.userId);
      validateString(name, false);
      validateString(color, true);
      validateString(description, true);
      try {
        return await DiscoveryTypesCollection.insertAsync({ name, color, description });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'discoveryTypes.update': async function (discoveryTypeId = '', data = {}) {
      validateUserId(this.userId);
      validateString(discoveryTypeId, false);
      validateObject(data, false);
      const discoveryType = await DiscoveryTypesCollection.findOneAsync(discoveryTypeId);
      validateObject(discoveryType, false);
      try {
        return await DiscoveryTypesCollection.updateAsync({ _id: discoveryTypeId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'discoveryTypes.remove': async function (discoveryTypeId = '') {
      validateUserId(this.userId);
      validateString(discoveryTypeId, false);
      const discoveryType = await DiscoveryTypesCollection.findOneAsync(discoveryTypeId);
      validateObject(discoveryType, false);
      try {
        return await DiscoveryTypesCollection.removeAsync({ _id: discoveryTypeId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
