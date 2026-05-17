import React from 'react';
import MedalsCollection from '../../../api/collections/medals.collection';
import type { Medal } from '../../../api/types/misc';
import { useTranslation } from '../../../i18n/LanguageContext';
import { useTourRef } from '../../tour/TourContext';
import Section from '../../section/Section';
import getMedalColumns from './medals.columns';
import MedalsForm from './MedalsForm';

const Medals = () => {
  const { t } = useTranslation();
  const sectionRef = useTourRef('medals-section');

  return (
    <div ref={sectionRef}>
      <Section<Medal>
        title={t('members.medals')}
        collectionName="medals"
        FormComponent={MedalsForm}
        columnsFactory={getMedalColumns}
        Collection={MedalsCollection}
        useDrawerStack
      />
    </div>
  );
};

export default Medals;
