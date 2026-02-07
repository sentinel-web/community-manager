import React, { useCallback, useContext } from 'react';
import MembersCollection from '../../api/collections/members.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import Section from '../section/Section';
import MemberForm from './MemberForm';
import MemberProfile from './MemberProfile';
import getMembersColumns from './members.columns';

/**
 * Members management page component.
 * Displays a searchable table of community members with CRUD operations.
 * No props - uses Section component for data fetching and display.
 */
export default function Members() {
  const { t } = useTranslation();
  const drawer = useContext(DrawerContext);

  const onViewProfile = useCallback(
    memberId => {
      drawer.setDrawerTitle(t('members.viewProfile'));
      drawer.setDrawerModel({});
      drawer.setDrawerComponent(<MemberProfile memberId={memberId} />);
      drawer.setDrawerOpen(true);
    },
    [drawer, t]
  );

  const columnsFactory = useCallback(
    (handleEdit, handleDelete, permissions, t) => getMembersColumns(handleEdit, handleDelete, permissions, t, { onViewProfile }),
    [onViewProfile]
  );

  const filterFactory = useCallback(
    string => ({
      $or: [
        { username: { $regex: string, $options: 'i' } },
        { 'profile.name': { $regex: string, $options: 'i' } },
        { 'profile.id': { $regex: string, $options: 'i' } },
        { 'profile.discordTag': { $regex: string, $options: 'i' } },
      ],
    }),
    []
  );

  return (
    <Section
      title={t('members.title')}
      collectionName="members"
      Collection={MembersCollection}
      FormComponent={MemberForm}
      columnsFactory={columnsFactory}
      filterFactory={filterFactory}
    />
  );
}
