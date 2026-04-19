import { Mongo } from 'meteor/mongo';
import type { Specialization } from '/imports/api/types';

const SpecializationsCollection = new Mongo.Collection<Specialization>('specializations');

export default SpecializationsCollection;
