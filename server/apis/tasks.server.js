import { Meteor } from 'meteor/meteor';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import { validateObject, validatePublish, validateString, validateUserId } from '../main';

if (Meteor.isServer) {
  Meteor.publish('tasks', function (filter = {}, options = {}) {
    validatePublish(this.userId, filter, options);
    return TasksCollection.find(filter, options);
  });

  Meteor.methods({
    'tasks.insert': async function (payload = {}) {
      validateUserId(this.userId);
      const { name, status, description, participants } = payload;
      validateString(name, false);
      validateString(status, false);
      validateString(description, true);
      validateString(participants, true);
      try {
        return await TasksCollection.insertAsync({ name, status, description, participants });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'tasks.update': async function (taskId = '', data = {}) {
      validateUserId(this.userId);
      validateString(taskId, false);
      validateObject(data, false);
      const task = await TasksCollection.findOneAsync(taskId);
      validateObject(task, false);
      try {
        return await TasksCollection.updateAsync({ _id: taskId }, { $set: data });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'tasks.remove': async function (taskId = '') {
      validateUserId(this.userId);
      validateString(taskId, false);
      const task = await TasksCollection.findOneAsync(taskId);
      validateObject(task, false);
      try {
        return await TasksCollection.removeAsync({ _id: taskId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
