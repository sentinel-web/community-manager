import React, { useCallback } from 'react';
import RegistrationsCollection from '../../api/collections/registrations.collection';
import Section from '../section/Section';
import getRegistrationColumns from './registration.columns';
import RegistrationForm from './RegistrationForm';

export default function Registration() {
  const filterFactory = useCallback(string => ({ name: { $regex: string, $options: 'i' } }), []);
  return (
    <Section
      title="Registration"
      collectionName="registrations"
      Collection={RegistrationsCollection}
      FormComponent={RegistrationForm}
      columnsFactory={getRegistrationColumns}
      filterFactory={filterFactory}
    />
  );
}
