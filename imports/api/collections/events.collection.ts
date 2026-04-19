import { Mongo } from 'meteor/mongo';
import type { EventDoc } from '/imports/api/types';

const EventsCollection = new Mongo.Collection<EventDoc>('events');

export default EventsCollection;
