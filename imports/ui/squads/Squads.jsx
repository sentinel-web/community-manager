import React, { useMemo } from 'react';
import SquadsCollection from '../../api/collections/squads.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import Section from '../section/Section';
import SquadMembers from './SquadMembers';
import SquadsForm from './SquadsForm';
import getSquadsColumns from './squads.columns';

export default function Squads() {
  const { t } = useTranslation();

  const expandable = useMemo(
    () => ({
      expandedRowRender: record => <SquadMembers squadId={record._id} />,
    }),
    []
  );

  return (
    <Section
      title={t('squads.title')}
      collectionName="squads"
      Collection={SquadsCollection}
      FormComponent={SquadsForm}
      columnsFactory={getSquadsColumns}
      expandable={expandable}
    />
  );
}
