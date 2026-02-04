import React from 'react';
import RolesCollection from '../../../api/collections/roles.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import Section from '../../section/Section';
import RolesForm from './RolesForm';
import getRolesColumns from './roles.columns';

const Roles = () => {
  const { t } = useTranslation();

  return <Section Collection={RolesCollection} collectionName="roles" title={t('members.roles')} FormComponent={RolesForm} columnsFactory={getRolesColumns} />;
};

export default Roles;
