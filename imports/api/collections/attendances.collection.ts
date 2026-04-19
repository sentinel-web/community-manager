import { Mongo } from 'meteor/mongo';
import type { AttendanceStatus } from '/imports/api/types';

type AttendancesDoc = { _id: string } & Record<string, Record<string, AttendanceStatus>>;

const AttendancesCollection = new Mongo.Collection<AttendancesDoc>('attendances');

export default AttendancesCollection;
