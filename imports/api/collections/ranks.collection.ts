import { Mongo } from 'meteor/mongo';
import type { Rank } from '/imports/api/types';

const RanksCollection = new Mongo.Collection<Rank>('ranks');

export default RanksCollection;
