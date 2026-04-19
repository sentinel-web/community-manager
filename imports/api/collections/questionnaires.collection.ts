import { Mongo } from 'meteor/mongo';
import type { Questionnaire } from '/imports/api/types';

const QuestionnairesCollection = new Mongo.Collection<Questionnaire>('questionnaires');

export default QuestionnairesCollection;
