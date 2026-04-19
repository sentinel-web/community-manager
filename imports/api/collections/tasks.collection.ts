import { Mongo } from 'meteor/mongo';
import type { Task } from '/imports/api/types';

const TasksCollection = new Mongo.Collection<Task>('tasks');

export default TasksCollection;
