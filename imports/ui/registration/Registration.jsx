import React, { useCallback } from 'react';
import RegistrationsCollection from '../../api/collections/registrations.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import Section from '../section/Section';
import getRegistrationColumns from './registration.columns';
import RegistrationForm from './RegistrationForm';

export default function Registration() {
  const { t } = useTranslation();
  const filterFactory = useCallback(string => ({ name: { $regex: string, $options: 'i' } }), []);

  return (
    <Section
      title={t('registrations.title')}
      collectionName="registrations"
      Collection={RegistrationsCollection}
      FormComponent={RegistrationForm}
      columnsFactory={getRegistrationColumns}
      filterFactory={filterFactory}
    />
  );
}
