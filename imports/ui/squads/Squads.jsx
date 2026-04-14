import React, { useMemo } from 'react';
import SquadsCollection from '../../api/collections/squads.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { useTourRef } from '../tour/TourContext';
import Section from '../section/Section';
import SquadMembers from './SquadMembers';
import SquadsForm from './SquadsForm';
import getSquadsColumns from './squads.columns';

export default function Squads() {
  const { t } = useTranslation();
  const sectionRef = useTourRef('squads-section');

  const expandable = useMemo(
    () => ({
      expandedRowRender: record => <SquadMembers squadId={record._id} />,
    }),
    []
  );

  return (
    <div ref={sectionRef}>
      <Section
        title={t('squads.title')}
        collectionName="squads"
        Collection={SquadsCollection}
        FormComponent={SquadsForm}
        columnsFactory={getSquadsColumns}
        expandable={expandable}
      />
    </div>
  );
}
