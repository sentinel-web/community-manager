import React from 'react';
import RolesCollection from '../../../api/collections/roles.collection';
import type { Role } from '../../../api/types/role';
import { useTranslation } from '../../../i18n/LanguageContext';
import { useTourRef } from '../../tour/TourContext';
import Section from '../../section/Section';
import RolesForm from './RolesForm';
import getRolesColumns from './roles.columns';

const Roles = () => {
  const { t } = useTranslation();
  const sectionRef = useTourRef('roles-section');

  return (
    <div ref={sectionRef}>
      <Section<Role>
        Collection={RolesCollection}
        collectionName="roles"
        title={t('members.roles')}
        FormComponent={RolesForm}
        columnsFactory={getRolesColumns}
        useDrawerStack
      />
    </div>
  );
};

export default Roles;
