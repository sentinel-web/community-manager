import { Meteor } from 'meteor/meteor';
import TaskStatusCollection from '../../imports/api/collections/taskStatus.collection';
import { validateObject, validatePublish, validateString, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('taskStatus', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return TaskStatusCollection.find(filter, options);
  });

  Meteor.methods({
    'taskStatus.insert': async function ({ name = '', color = '', description = '' } = {}) {
      validateUserId(this.userId);
      validateString(name, true);
      validateString(color, false);
      validateString(description, false);
      try {
        return await TaskStatusCollection.insertAsync({ name, color, description });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'taskStatus.update': async function (taskStatusId = '', data = {}) {
      validateUserId(this.userId);
      validateString(taskStatusId, true);
      validateObject(data, true);
      const taskStatus = await TaskStatusCollection.findOneAsync(taskStatusId);
      validateObject(taskStatus, true);
      try {
        return await TaskStatusCollection.updateAsync({ _id: taskStatusId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'taskStatus.remove': async function (taskStatusId = '') {
      validateUserId(this.userId);
      validateString(taskStatusId, true);
      const taskStatus = await TaskStatusCollection.findOneAsync(taskStatusId);
      validateObject(taskStatus, true);
      try {
        return await TaskStatusCollection.removeAsync({ _id: taskStatusId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
