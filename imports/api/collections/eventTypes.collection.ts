import { Mongo } from 'meteor/mongo';
import type { EventType } from '/imports/api/types';

const EventTypesCollection = new Mongo.Collection<EventType>('eventTypes');

export default EventTypesCollection;
