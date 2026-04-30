import { Mongo } from 'meteor/mongo';
import type { AttendanceDoc } from '/imports/api/types/shared';

const AttendancesCollection = new Mongo.Collection<AttendanceDoc>('attendances');

export default AttendancesCollection;
