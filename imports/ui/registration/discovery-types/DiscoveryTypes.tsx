import React from 'react';
import DiscoveryTypesCollection from '../../../api/collections/discoveryTypes.collection';
import type { DiscoveryType } from '../../../api/types/misc';
import { useTranslation } from '../../../i18n/LanguageContext';
import Section from '../../section/Section';
import DiscoveryTypeForm from './DiscoveryTypesForm';
import getDiscoveryTypeColumns from './discoveryTypes.columns';

const DiscoveryTypes = () => {
  const { t } = useTranslation();

  return (
    <Section<DiscoveryType>
      title={t('registrations.discoveryTypes')}
      collectionName="discoveryTypes"
      FormComponent={DiscoveryTypeForm}
      columnsFactory={getDiscoveryTypeColumns}
      Collection={DiscoveryTypesCollection}
    />
  );
};

export default DiscoveryTypes;
