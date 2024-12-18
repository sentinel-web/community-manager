import { Mongo } from 'meteor/mongo';

const DiscoveryTypesCollection = new Mongo.Collection('discoveryTypes');

export default DiscoveryTypesCollection;
