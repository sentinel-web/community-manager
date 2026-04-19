import { Mongo } from 'meteor/mongo';
import type { QuestionnaireResponse } from '/imports/api/types';

const QuestionnaireResponsesCollection = new Mongo.Collection<QuestionnaireResponse>('questionnaireResponses');

export default QuestionnaireResponsesCollection;
