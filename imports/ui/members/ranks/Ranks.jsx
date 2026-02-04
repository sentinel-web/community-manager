import React from 'react';
import RanksCollection from '../../../api/collections/ranks.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import Section from '../../section/Section';
import RanksForm from './RanksForm';
import getRankColumns from './ranks.columns';

const Ranks = () => {
  const { t } = useTranslation();

  return <Section title={t('members.ranks')} collectionName="ranks" FormComponent={RanksForm} columnsFactory={getRankColumns} Collection={RanksCollection} />;
};

export default Ranks;
