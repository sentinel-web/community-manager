import { Mongo } from 'meteor/mongo';

const QuestionnaireResponsesCollection = new Mongo.Collection('questionnaireResponses');

export default QuestionnaireResponsesCollection;
