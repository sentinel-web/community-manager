import React, { useCallback, useContext } from 'react';
import QuestionnairesCollection from '../../api/collections/questionnaires.collection';
import type { Questionnaire } from '../../api/types/questionnaire';
import { useTranslation } from '../../i18n/LanguageContext';
import type { DrawerContextValue } from '../app/types';
import { DrawerContext } from '../app/App';
import type { ColumnsFactory, RowClickEvent, SectionPermissions, TranslateFn } from '../section/types';
import Section from '../section/Section';
import { useTourRef } from '../tour/TourContext';
import QuestionnaireForm from './QuestionnaireForm';
import QuestionnaireResponses from './QuestionnaireResponses';
import getQuestionnaireColumns from './questionnaire.columns';

const Questionnaires = () => {
  const drawer = useContext(DrawerContext) as DrawerContextValue;
  const { t } = useTranslation();
  const sectionRef = useTourRef('questionnaires-section');

  const handleViewResponses = useCallback(
    (e: RowClickEvent, record: Questionnaire) => {
      e.preventDefault();
      drawer.setDrawerModel(record as unknown as Record<string, unknown>);
      drawer.setDrawerTitle(`${t('questionnaires.responses')}: ${record.name}`);
      drawer.setDrawerComponent(React.createElement(QuestionnaireResponses));
      drawer.setDrawerOpen(true);
    },
    [drawer, t]
  );

  const columnsFactory: ColumnsFactory<Questionnaire> = useCallback(
    (handleEdit: (e: RowClickEvent, record: Questionnaire) => void, handleDelete: (e: RowClickEvent, record: Questionnaire) => void, permissions: SectionPermissions, tFn: TranslateFn) =>
      getQuestionnaireColumns(handleEdit, handleDelete, permissions, tFn, handleViewResponses),
    [handleViewResponses]
  );

  return (
    <div ref={sectionRef as React.RefObject<HTMLDivElement>}>
      <Section<Questionnaire>
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
