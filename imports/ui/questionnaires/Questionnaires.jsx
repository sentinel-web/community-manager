import React, { useCallback, useContext } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import QuestionnairesCollection from '../../api/collections/questionnaires.collection';
import { DrawerContext } from '../app/App';
import { useTourRef } from '../tour/TourContext';
import Section from '../section/Section';
import QuestionnaireForm from './QuestionnaireForm';
import QuestionnaireResponses from './QuestionnaireResponses';
import getQuestionnaireColumns from './questionnaire.columns';

const Questionnaires = () => {
  const drawer = useContext(DrawerContext);
  const { t } = useTranslation();
  const sectionRef = useTourRef('questionnaires-section');

  const handleViewResponses = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle(`${t('questionnaires.responses')}: ${record.name}`);
      drawer.setDrawerComponent(React.createElement(QuestionnaireResponses));
      drawer.setDrawerOpen(true);
    },
    [drawer, t]
  );

  const columnsFactory = useCallback(
    (handleEdit, handleDelete, permissions, t) => getQuestionnaireColumns(handleEdit, handleDelete, permissions, t, handleViewResponses),
    [handleViewResponses]
  );

  return (
    <div ref={sectionRef}>
      <Section
        Collection={QuestionnairesCollection}
        collectionName="questionnaires"
        title={t('questionnaires.title')}
        FormComponent={QuestionnaireForm}
        columnsFactory={columnsFactory}
      />
    </div>
  );
};

export default Questionnaires;
