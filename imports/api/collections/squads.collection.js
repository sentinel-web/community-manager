import { Mongo } from 'meteor/mongo';

const SquadsCollection = new Mongo.Collection('squads');

export default SquadsCollection;
