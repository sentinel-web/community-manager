import React from 'react';
import MedalsCollection from '../../../api/collections/medals.collection';
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
      <Section title={t('members.medals')} collectionName="medals" FormComponent={MedalsForm} columnsFactory={getMedalColumns} Collection={MedalsCollection} />
    </div>
  );
};

export default Medals;
