import { Mongo } from 'meteor/mongo';

const QuestionnairesCollection = new Mongo.Collection('questionnaires');

export default QuestionnairesCollection;
