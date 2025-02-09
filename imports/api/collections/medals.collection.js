import { Mongo } from 'meteor/mongo';

const MedalsCollection = new Mongo.Collection('medals');

export default MedalsCollection;
