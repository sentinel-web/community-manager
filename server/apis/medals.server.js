import { Meteor } from 'meteor/meteor';
import { validateObject, validatePublish, validateString, validateUserId } from '../main';
import MedalsCollection from '../../imports/api/collections/medals.collection';

function publishMedals(filter = {}, options = {}) {
  try {
    validatePublish(this.userId, filter, options);
    return MedalsCollection.find(filter, options);
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function findMedal(medalId = '') {
  validateString(medalId, false);
  return await MedalsCollection.findOneAsync(medalId);
}

async function createMedal(payload = {}) {
  validateUserId(this.userId);
  validateObject(payload, false);
  const { name, description, color } = payload;
  return await MedalsCollection.insertAsync({ name, description, color });
}

async function updateMedal(medalId = '', data = {}) {
  const medal = await findMedal(medalId);
  validateObject(medal, false);
  validateObject(data, false);
  return await MedalsCollection.updateAsync({ _id: medalId }, { $set: data });
}

async function removeMedal(medalId = '') {
  const medal = await findMedal(medalId);
  validateObject(medal, false);
  return await MedalsCollection.removeAsync({ _id: medalId });
}

async function medalOptions() {
  const medals = await MedalsCollection.find().fetchAsync();
  const options = [];
  for (const medal of medals) {
    options.push({
      label: medal.name || '-',
      value: medal._id,
      title: medal.description || medal.name || '-',
      raw: medal,
    });
  }

  return options;
}

if (Meteor.isServer) {
  Meteor.publish('medals', function (filter = {}, options = {}) {
    try {
      validatePublish(this.userId, filter, options);
      return MedalsCollection.find(filter, options);
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  Meteor.methods({
    'medals.insert': createMedal,
    'medals.update': updateMedal,
    'medals.remove': removeMedal,
    'medals.options': medalOptions,
  });
}
