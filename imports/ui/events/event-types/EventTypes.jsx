import React from 'react';
import EventTypesCollection from '../../../api/collections/eventTypes.collection';
import Section from '../../section/Section';
import EventTypesForm from './EventTypesForm';
import getEventTypeColumns from './eventTypes.columns';

const EventTypes = () => {
  return (
    <Section
      title="Event Types"
      collectionName="eventTypes"
      Collection={EventTypesCollection}
      FormComponent={EventTypesForm}
      columnsFactory={getEventTypeColumns}
    />
  );
};

export default EventTypes;
