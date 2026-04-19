import { Mongo } from 'meteor/mongo';
import type { Medal } from '/imports/api/types';

const MedalsCollection = new Mongo.Collection<Medal>('medals');

export default MedalsCollection;
