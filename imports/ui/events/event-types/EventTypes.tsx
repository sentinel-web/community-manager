import React from 'react';
import EventTypesCollection from '../../../api/collections/eventTypes.collection';
import { Mongo } from 'meteor/mongo';
import type { CollectionDoc } from '../../components/CollectionSelect';
import type { ColumnsFactory } from '../../section/types';
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
      Collection={EventTypesCollection as unknown as Mongo.Collection<CollectionDoc>}
      FormComponent={EventTypesForm}
      columnsFactory={getEventTypeColumns as unknown as ColumnsFactory<CollectionDoc>}
    />
  );
};

export default EventTypes;
