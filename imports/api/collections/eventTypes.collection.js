import { Mongo } from 'meteor/mongo';

const EventTypesCollection = new Mongo.Collection('eventTypes');

export default EventTypesCollection;
