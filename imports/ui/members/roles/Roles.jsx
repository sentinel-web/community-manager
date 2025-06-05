import React from 'react';
import RolesCollection from '../../../api/collections/roles.collection';
import Section from '../../section/Section';
import RolesForm from './RolesForm';
import getRolesColumns from './roles.columns';

const Roles = () => {
  return <Section Collection={RolesCollection} collectionName="roles" title="Roles" FormComponent={RolesForm} columnsFactory={getRolesColumns} />;
};

export default Roles;
