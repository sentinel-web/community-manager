import { Meteor } from 'meteor/meteor';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import { validateString, validateUserId } from '../main';
import { createLog } from './logs.server';
import type { TaskComment } from '/imports/api/types';

if (Meteor.isServer) {
  Meteor.methods({
    'tasks.addComment': async function (taskId: string, text: string): Promise<TaskComment> {
      validateUserId(this.userId);
      validateString(taskId, false);
      validateString(text, false);

      const task = await TasksCollection.findOneAsync(taskId);
      if (!task) throw new Meteor.Error(404, 'Task not found');

      const comment: TaskComment = {
        userId: this.userId,
        text,
        createdAt: new Date(),
      };

      await TasksCollection.updateAsync({ _id: taskId }, { $push: { comments: comment } });
      await createLog('tasks.commentAdded', { taskId, userId: this.userId });
      return comment;
    },
  });
}
