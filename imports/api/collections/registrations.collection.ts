import { Mongo } from 'meteor/mongo';
import type { Registration } from '/imports/api/types';

const RegistrationsCollection = new Mongo.Collection<Registration>('registrations');

export default RegistrationsCollection;
