import { Mongo } from 'meteor/mongo';

const PositionsCollection = new Mongo.Collection('positions');

export default PositionsCollection;
