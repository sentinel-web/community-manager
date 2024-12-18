import { Meteor } from 'meteor/meteor';
import TaskStatusCollection from '../../imports/api/collections/taskStatus.collection';

if (Meteor.isServer) {
  Meteor.publish('taskStatus', function (filter = {}, options = {}) {
    if (!this.userId || typeof this.userId !== 'string') {
      throw new Meteor.Error('taskStatus', 'not-authorized', JSON.stringify(this.userId));
    }
    if (!filter || typeof filter !== 'object') {
      throw new Meteor.Error('taskStatus', 'Invalid filter', JSON.stringify(filter));
    }
    if (!options || typeof options !== 'object') {
      throw new Meteor.Error('taskStatus', 'Invalid options', JSON.stringify(options));
    }

    return TaskStatusCollection.find(filter, options);
  });

  Meteor.methods({
    'taskStatus.insert': async function ({ name = '', color = '', description = '' } = {}) {
      if (!this.userId) {
        throw new Meteor.Error('taskStatus.insert', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!name || typeof name !== 'string') {
        throw new Meteor.Error('taskStatus.insert', 'Invalid name', JSON.stringify(name));
      }
      if (typeof color !== 'string' && color != null) {
        throw new Meteor.Error('taskStatus.insert', 'Invalid color', JSON.stringify(color));
      }
      if (typeof description !== 'string' && description != null) {
        throw new Meteor.Error('taskStatus.insert', 'Invalid description', JSON.stringify(description));
      }
      try {
        return await TaskStatusCollection.insertAsync({ name, color, description });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    'taskStatus.update': async function (taskStatusId = '', data = {}) {
      if (!taskStatusId || typeof taskStatusId !== 'string') {
        throw new Meteor.Error('taskStatus.update', 'Invalid taskStatus ID', JSON.stringify(taskStatusId));
      }
      if (!data || typeof data !== 'object') {
        throw new Meteor.Error('taskStatus.update', 'Invalid data', JSON.stringify(data));
      }
      if (!this.userId) {
        throw new Meteor.Error('taskStatus.update', 'not-authorized', JSON.stringify(this.userId));
      }
      const discoveryType = await TaskStatusCollection.findOneAsync(taskStatusId);
      if (discoveryType) {
        try {
          return await TaskStatusCollection.updateAsync({ _id: taskStatusId }, { $set: data });
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      } else {
        throw new Meteor.Error('taskStatus.update', 'taskStatus-not-found', JSON.stringify(taskStatusId));
      }
    },
    'taskStatus.remove': async function (taskStatusId = '') {
      if (!this.userId) {
        throw new Meteor.Error('taskStatus.remove', 'not-authorized', JSON.stringify(this.userId));
      }
      if (!taskStatusId || typeof taskStatusId !== 'string') {
        throw new Meteor.Error('taskStatus.remove', 'Invalid taskStatus ID', JSON.stringify(taskStatusId));
      }

      const taskStatus = await TaskStatusCollection.findOneAsync(taskStatusId);
      if (!taskStatus) {
        throw new Meteor.Error('taskStatus.remove', 'taskStatus-not-found', JSON.stringify(taskStatusId));
      }

      try {
        return await TaskStatusCollection.removeAsync({ _id: taskStatusId });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
