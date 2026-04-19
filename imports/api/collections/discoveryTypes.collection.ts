import { Mongo } from 'meteor/mongo';
import type { DiscoveryType } from '/imports/api/types';

const DiscoveryTypesCollection = new Mongo.Collection<DiscoveryType>('discoveryTypes');

export default DiscoveryTypesCollection;
