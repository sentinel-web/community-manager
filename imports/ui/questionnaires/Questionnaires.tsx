import React, { useCallback } from 'react';
import QuestionnairesCollection from '../../api/collections/questionnaires.collection';
import type { Questionnaire } from '../../api/types/questionnaire';
import { useTranslation } from '../../i18n/LanguageContext';
import { useDrawerStack } from '../drawer-stack';
import type { ColumnsFactory, RowClickEvent, SectionPermissions, TranslateFn } from '../section/types';
import Section from '../section/Section';
import { useTourRef } from '../tour/TourContext';
import QuestionnaireForm from './QuestionnaireForm';
import QuestionnaireResponses from './QuestionnaireResponses';
import getQuestionnaireColumns from './questionnaire.columns';

const Questionnaires = () => {
  const drawerStack = useDrawerStack();
  const { t } = useTranslation();
  const sectionRef = useTourRef('questionnaires-section');

  const handleViewResponses = useCallback(
    (e: RowClickEvent, record: Questionnaire) => {
      e.preventDefault();
      void drawerStack.push<void, Questionnaire>({
        title: `${t('questionnaires.responses')}: ${record.name}`,
        Component: QuestionnaireResponses,
        model: record,
      });
    },
    [drawerStack, t]
  );

  const columnsFactory: ColumnsFactory<Questionnaire> = useCallback(
    (handleEdit: (e: RowClickEvent, record: Questionnaire) => void, handleDelete: (e: RowClickEvent, record: Questionnaire) => void, permissions: SectionPermissions, tFn: TranslateFn) =>
      getQuestionnaireColumns(handleEdit, handleDelete, permissions, tFn, handleViewResponses),
    [handleViewResponses]
  );

  return (
    <div ref={sectionRef}>
      <Section<Questionnaire>
        Collection={QuestionnairesCollection}
        collectionName="questionnaires"
        title={t('questionnaires.title')}
        FormComponent={QuestionnaireForm}
        columnsFactory={columnsFactory}
        useDrawerStack
      />
    </div>
  );
};

export default Questionnaires;
