import React from 'react';
import SpecializationsCollection from '../../api/collections/specializations.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import Section from '../section/Section';
import SpecializationForm from './SpecializationForm';
import getSpecializationColumns from './specializations.columns';

export default function Specializations() {
  const { t } = useTranslation();

  return (
    <Section
      title={t('specializations.title')}
      collectionName="specializations"
      Collection={SpecializationsCollection}
      FormComponent={SpecializationForm}
      columnsFactory={getSpecializationColumns}
      filterFactory={string => ({ name: { $regex: string, $options: 'i' } })}
    />
  );
}
