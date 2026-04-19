import { Mongo } from 'meteor/mongo';
import type { LogEntry } from '/imports/api/types';

const LogsCollection = new Mongo.Collection<LogEntry>('logs');

export default LogsCollection;
