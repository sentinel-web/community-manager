import { Col, Select } from 'antd';
import { Mongo } from 'meteor/mongo';
import React, { useCallback, useMemo, useState } from 'react';
import MembersCollection from '../../api/collections/members.collection';
import type { Member } from '../../api/types/member';
import { useTranslation } from '../../i18n/LanguageContext';
import Section from '../section/Section';
import { useTourRef } from '../tour/TourContext';
import MemberForm from './MemberForm';
import MemberProfile from './MemberProfile';
import getMembersColumns from './members.columns';
import MembersSquadView from './MembersSquadView';

/**
 * Members management page component.
 * Displays a searchable table of community members with CRUD operations.
 * Supports table view and squad-grouped view.
 */
export default function Members() {
  const { t } = useTranslation();
  const tableRef = useTourRef('members-table');
  const [viewType, setViewType] = useState('table');

  const filterFactory = useCallback(
    (string: string): Mongo.Selector<Member> => ({
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
      expandedRowRender: (record: Member) => <MemberProfile memberId={record._id} />,
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
    <div ref={tableRef}>
      <Section<Member>
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
    </div>
  );
}
