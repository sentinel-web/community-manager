import React from 'react';
import PositionsCollection from '../../../api/collections/positions.collection';
import type { Position } from '../../../api/types/misc';
import { useTranslation } from '../../../i18n/LanguageContext';
import Section from '../../section/Section';
import PositionsForm from './PositionsForm';
import getPositionColumns from './positions.columns';

const Positions = () => {
  const { t } = useTranslation();

  return (
    <Section<Position>
      title={t('navigation.positions')}
      collectionName="positions"
      FormComponent={PositionsForm}
      columnsFactory={getPositionColumns}
      Collection={PositionsCollection}
      useDrawerStack
    />
  );
};

export default Positions;
