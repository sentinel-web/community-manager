import { Mongo } from 'meteor/mongo';

const AttendancesCollection = new Mongo.Collection('attendances');

export default AttendancesCollection;
