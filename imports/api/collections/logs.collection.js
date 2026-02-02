import { Mongo } from 'meteor/mongo';

const LogsCollection = new Mongo.Collection('logs');

export default LogsCollection;
