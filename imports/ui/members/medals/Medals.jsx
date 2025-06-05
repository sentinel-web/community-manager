import React from 'react';
import MedalsCollection from '../../../api/collections/medals.collection';
import Section from '../../section/Section';
import getMedalColumns from './medals.columns';
import MedalsForm from './MedalsForm';

const Medals = () => {
  return <Section title="Medals" collectionName="medals" FormComponent={MedalsForm} columnsFactory={getMedalColumns} Collection={MedalsCollection} />;
};

export default Medals;
