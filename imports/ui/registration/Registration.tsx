import { Mongo } from 'meteor/mongo';
import React, { useCallback } from 'react';
import RegistrationsCollection from '../../api/collections/registrations.collection';
import type { Registration as RegistrationDoc } from '../../api/types';
import { useTranslation } from '../../i18n/LanguageContext';
import { useTourRef } from '../tour/TourContext';
import Section from '../section/Section';
import getRegistrationColumns from './registration.columns';
import RegistrationForm from './RegistrationForm';

// Newest applications first — the page loads one capped page at a time, so the
// order has to be applied server-side or today's application hides behind
// "load more". Module-level constant to keep the subscription identity stable.
const NEWEST_FIRST: Mongo.SortSpecifier = { createdAt: -1 };

export default function Registration() {
  const { t } = useTranslation();
  const sectionRef = useTourRef('registrations-section');
  const filterFactory = useCallback((string: string) => ({ name: { $regex: string, $options: 'i' } }), []);

  return (
    <div ref={sectionRef}>
      <Section<RegistrationDoc>
        title={t('registrations.title')}
        collectionName="registrations"
        Collection={RegistrationsCollection}
        FormComponent={RegistrationForm}
        columnsFactory={getRegistrationColumns}
        filterFactory={filterFactory}
        sort={NEWEST_FIRST}
      />
    </div>
  );
}
