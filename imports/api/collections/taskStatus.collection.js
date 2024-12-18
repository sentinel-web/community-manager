import { Mongo } from 'meteor/mongo';

const TaskStatusCollection = new Mongo.Collection('taskStatus');

export default TaskStatusCollection;
