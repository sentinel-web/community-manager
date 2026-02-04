import React from 'react';
import EventTypesCollection from '../../../api/collections/eventTypes.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import Section from '../../section/Section';
import EventTypesForm from './EventTypesForm';
import getEventTypeColumns from './eventTypes.columns';

const EventTypes = () => {
  const { t } = useTranslation();

  return (
    <Section
      title={t('events.eventTypes')}
      collectionName="eventTypes"
      Collection={EventTypesCollection}
      FormComponent={EventTypesForm}
      columnsFactory={getEventTypeColumns}
    />
  );
};

export default EventTypes;
