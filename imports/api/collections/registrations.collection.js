import { Mongo } from 'meteor/mongo';

const RegistrationsCollection = new Mongo.Collection('registrations');

export default RegistrationsCollection;
