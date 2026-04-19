import { Mongo } from 'meteor/mongo';
import type { Role } from '/imports/api/types';

const RolesCollection = new Mongo.Collection<Role>('roles');

export default RolesCollection;
