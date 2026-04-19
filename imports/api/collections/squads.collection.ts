import { Mongo } from 'meteor/mongo';
import type { Squad } from '/imports/api/types';

const SquadsCollection = new Mongo.Collection<Squad>('squads');

export default SquadsCollection;
