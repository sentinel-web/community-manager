import React from 'react';
import type { Specialization } from '../../api/types/misc';
import SpecializationsCollection from '../../api/collections/specializations.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { useTourRef } from '../tour/TourContext';
import Section from '../section/Section';
import SpecializationForm from './SpecializationForm';
import getSpecializationColumns from './specializations.columns';

export default function Specializations() {
  const { t } = useTranslation();
  const sectionRef = useTourRef('specializations-section');

  return (
    <div ref={sectionRef}>
      <Section<Specialization>
        title={t('specializations.title')}
        collectionName="specializations"
        Collection={SpecializationsCollection}
        FormComponent={SpecializationForm}
        columnsFactory={getSpecializationColumns}
        filterFactory={string => ({ name: { $regex: string, $options: 'i' } })}
        useDrawerStack
      />
    </div>
  );
}
