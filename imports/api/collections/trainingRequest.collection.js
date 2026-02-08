import { Mongo } from 'meteor/mongo';

const TrainingRequests = new Mongo.Collection('training_requests');
export default TrainingRequests;
