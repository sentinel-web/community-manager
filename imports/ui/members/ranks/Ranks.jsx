import React from 'react';
import RanksCollection from '../../../api/collections/ranks.collection';
import Section from '../../section/Section';
import RanksForm from './RanksForm';
import getRankColumns from './ranks.columns';

const Ranks = () => {
  return <Section title="Ranks" collectionName="ranks" FormComponent={RanksForm} columnsFactory={getRankColumns} Collection={RanksCollection} />;
};

export default Ranks;
