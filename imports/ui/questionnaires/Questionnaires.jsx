import React from 'react';
import QuestionnairesCollection from '../../api/collections/questionnaires.collection';
import Section from '../section/Section';
import QuestionnaireForm from './QuestionnaireForm';
import getQuestionnaireColumns from './questionnaire.columns';

const Questionnaires = () => {
  return (
    <Section
      Collection={QuestionnairesCollection}
      collectionName="questionnaires"
      title="Questionnaires"
      FormComponent={QuestionnaireForm}
      columnsFactory={getQuestionnaireColumns}
    />
  );
};

export default Questionnaires;
