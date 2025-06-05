import { Mongo } from 'meteor/mongo';

const RolesCollection = new Mongo.Collection('roles');

export default RolesCollection;
