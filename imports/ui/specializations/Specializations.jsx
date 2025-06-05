import React from 'react';
import SpecializationsCollection from '../../api/collections/specializations.collection';
import Section from '../section/Section';
import SpecializationForm from './SpecializationForm';
import getSpecializationColumns from './specializations.columns';

export default function Specializations() {
  return (
    <Section
      title="Specializations"
      collectionName="specializations"
      Collection={SpecializationsCollection}
      FormComponent={SpecializationForm}
      columnsFactory={getSpecializationColumns}
      filterFactory={string => ({ name: { $regex: string, $options: 'i' } })}
    />
  );
}
