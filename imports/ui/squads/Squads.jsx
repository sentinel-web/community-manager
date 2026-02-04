import React from 'react';
import SquadsCollection from '../../api/collections/squads.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import Section from '../section/Section';
import SquadsForm from './SquadsForm';
import getSquadsColumns from './squads.columns';

export default function Squads() {
  const { t } = useTranslation();

  return (
    <Section title={t('squads.title')} collectionName="squads" Collection={SquadsCollection} FormComponent={SquadsForm} columnsFactory={getSquadsColumns} />
  );
}
