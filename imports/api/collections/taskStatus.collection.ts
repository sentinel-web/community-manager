import { Mongo } from 'meteor/mongo';
import type { TaskStatus } from '/imports/api/types';

const TaskStatusCollection = new Mongo.Collection<TaskStatus>('taskStatus');

export default TaskStatusCollection;
