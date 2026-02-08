import { Col, Select } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import MembersCollection from '../../api/collections/members.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import Section from '../section/Section';
import MemberForm from './MemberForm';
import MemberProfile from './MemberProfile';
import MembersSquadView from './MembersSquadView';
import getMembersColumns from './members.columns';

/**
 * Members management page component.
 * Displays a searchable table of community members with CRUD operations.
 * Supports table view and squad-grouped view.
 */
export default function Members() {
  const { t } = useTranslation();
  const [viewType, setViewType] = useState('table');

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

  const customView = useMemo(() => (viewType === 'squad' ? MembersSquadView : false), [viewType]);

  const expandable = useMemo(
    () => ({
      expandedRowRender: record => <MemberProfile memberId={record._id} />,
    }),
    []
  );

  const viewOptions = useMemo(
    () => [
      { value: 'table', label: t('members.tableView') },
      { value: 'squad', label: t('members.squadView') },
    ],
    [t]
  );

  return (
    <Section
      title={t('members.title')}
      collectionName="members"
      Collection={MembersCollection}
      FormComponent={MemberForm}
      columnsFactory={getMembersColumns}
      filterFactory={filterFactory}
      customView={customView}
      expandable={expandable}
      headerExtra={
        <Col>
          <Select style={{ minWidth: 125 }} value={viewType} onChange={setViewType} options={viewOptions} />
        </Col>
      }
    />
  );
}
