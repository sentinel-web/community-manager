import { Mongo } from 'meteor/mongo';
import type { Position } from '/imports/api/types';

const PositionsCollection = new Mongo.Collection<Position>('positions');

export default PositionsCollection;
