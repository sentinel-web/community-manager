import { Mongo } from 'meteor/mongo';

const RanksCollection = new Mongo.Collection('ranks');

export default RanksCollection;
