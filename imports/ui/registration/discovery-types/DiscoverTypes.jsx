import React from 'react';
import DiscoveryTypesCollection from '../../../api/collections/discoveryTypes.collection';
import Section from '../../section/Section';
import DiscoveryTypeForm from './DiscoveryTypesForm';
import getDiscoveryTypeColumns from './dicovery-types.columns';

const DiscoveryTypes = () => {
  return (
    <Section
      title="Discovery Types"
      collectionName="discoveryTypes"
      FormComponent={DiscoveryTypeForm}
      columnsFactory={getDiscoveryTypeColumns}
      Collection={DiscoveryTypesCollection}
    />
  );
};

export default DiscoveryTypes;
