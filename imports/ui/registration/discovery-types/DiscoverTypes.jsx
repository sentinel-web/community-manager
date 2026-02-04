import React from 'react';
import DiscoveryTypesCollection from '../../../api/collections/discoveryTypes.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import Section from '../../section/Section';
import DiscoveryTypeForm from './DiscoveryTypesForm';
import getDiscoveryTypeColumns from './dicovery-types.columns';

const DiscoveryTypes = () => {
  const { t } = useTranslation();

  return (
    <Section
      title={t('registrations.discoveryTypes')}
      collectionName="discoveryTypes"
      FormComponent={DiscoveryTypeForm}
      columnsFactory={getDiscoveryTypeColumns}
      Collection={DiscoveryTypesCollection}
    />
  );
};

export default DiscoveryTypes;
