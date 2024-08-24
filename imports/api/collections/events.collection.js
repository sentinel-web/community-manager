import { Mongo } from "meteor/mongo";

const EventsCollection = new Mongo.Collection("events");

export default EventsCollection;
