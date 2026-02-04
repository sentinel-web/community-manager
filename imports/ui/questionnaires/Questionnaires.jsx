import React, { useCallback, useContext } from 'react';
import QuestionnairesCollection from '../../api/collections/questionnaires.collection';
import { DrawerContext } from '../app/App';
import Section from '../section/Section';
import QuestionnaireForm from './QuestionnaireForm';
import QuestionnaireResponses from './QuestionnaireResponses';
import getQuestionnaireColumns from './questionnaire.columns';

const Questionnaires = () => {
  const drawer = useContext(DrawerContext);

  const handleViewResponses = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle(`Responses: ${record.name}`);
      drawer.setDrawerComponent(React.createElement(QuestionnaireResponses));
      drawer.setDrawerOpen(true);
    },
    [drawer]
  );

  const columnsFactory = useCallback(
    (handleEdit, handleDelete, permissions) => getQuestionnaireColumns(handleEdit, handleDelete, permissions, handleViewResponses),
    [handleViewResponses]
  );

  return (
    <Section
      Collection={QuestionnairesCollection}
      collectionName="questionnaires"
      title="Manage Questionnaires"
      FormComponent={QuestionnaireForm}
      columnsFactory={columnsFactory}
    />
  );
};

export default Questionnaires;
