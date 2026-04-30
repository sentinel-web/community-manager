import React from 'react';
import RanksCollection from '../../../api/collections/ranks.collection';
import type { Rank } from '../../../api/types/rank';
import { useTranslation } from '../../../i18n/LanguageContext';
import { useTourRef } from '../../tour/TourContext';
import Section from '../../section/Section';
import RanksForm from './RanksForm';
import getRankColumns from './ranks.columns';

const Ranks = () => {
  const { t } = useTranslation();
  const sectionRef = useTourRef('ranks-section');

  return (
    <div ref={sectionRef}>
      <Section<Rank>
        title={t('members.ranks')}
        collectionName="ranks"
        FormComponent={RanksForm}
        columnsFactory={getRankColumns}
        Collection={RanksCollection}
      />
    </div>
  );
};

export default Ranks;
