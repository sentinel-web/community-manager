import React from 'react';
import BriefingTemplatesCollection from '../../api/collections/briefingTemplates.collection';
import type { BriefingTemplate } from '../../api/types';
import { useTranslation } from '../../i18n/LanguageContext';
import Section from '../section/Section';
import BriefingTemplatesForm from './BriefingTemplatesForm';
import getBriefingTemplateColumns from './briefingTemplates.columns';

const BriefingTemplates = () => {
  const { t } = useTranslation();

  return (
    <Section<BriefingTemplate>
      title={t('navigation.briefingTemplates')}
      collectionName="briefingTemplates"
      Collection={BriefingTemplatesCollection}
      FormComponent={BriefingTemplatesForm}
      columnsFactory={getBriefingTemplateColumns}
    />
  );
};

export default BriefingTemplates;
