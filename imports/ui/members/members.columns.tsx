import React from 'react';
import RanksCollection from '../../api/collections/ranks.collection';
import type { Member } from '../../api/types/member';
import type { ColumnsFactory } from '../section/types';
import { SquadTags } from '../squads/squads.columns';
import TableActions from '../table/body/actions/TableActions';
import RankTag from './ranks/RankTag';

/**
 * Factory function to generate table columns for members.
 * @param handleEdit - Callback function to handle editing a member. Called with (event, record).
 * @param handleDelete - Callback function to handle deleting a member. Called with (event, record).
 * @param permissions - Permission flags for the current user.
 * @param t - Translation function for i18n.
 * @returns Array of column configuration objects for Ant Design Table.
 */
const getMembersColumns: ColumnsFactory<Member> = (handleEdit, handleDelete, permissions, t) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ReturnType<ColumnsFactory<Member>> = [
    {
      title: t('members.squad'),
      dataIndex: 'profile.squadId',
      key: 'profile.squadId',
      ellipsis: true,
      sorter: (a: Member, b: Member) => String(a.profile!.squadId).localeCompare(String(b.profile!.squadId)),
      render: (_squadId: unknown, record: Member) => (record?.profile?.squadId ? <SquadTags squadIds={[record.profile.squadId!]} /> : '-'),
    },
    {
      title: t('members.rank'),
      dataIndex: 'rankId',
      key: 'profile.rankId',
      ellipsis: true,
      sorter: (a: Member, b: Member) => {
        const rankA = a.profile?.rankId ? RanksCollection.findOne({ _id: a.profile.rankId })?.name : a.profile!.rank || '-';
        const rankB = b.profile?.rankId ? RanksCollection.findOne({ _id: b.profile.rankId })?.name : b.profile!.rank || '-';
        return (rankA || '-').localeCompare(rankB || '-');
      },
      render: (_rankId: unknown, record: Member) => <RankTag rankId={record.profile?.rankId} />,
    },
    {
      title: t('columns.id'),
      dataIndex: 'id',
      key: 'profile.id',
      ellipsis: true,
      sorter: (a: Member, b: Member) => String(a.profile!.id).localeCompare(String(b.profile!.id)),
      render: (_id: unknown, record: Member) => (record.profile?.id ? record.profile.id : '-'),
    },
    {
      title: t('common.name'),
      dataIndex: 'profile.name',
      key: 'profile.name',
      ellipsis: true,
      sorter: (a: Member, b: Member) => String(a.profile!.name).localeCompare(String(b.profile!.name)),
      render: (_name: unknown, record: Member) => record.profile?.name || '-',
    },
  ];

  // Only add Actions column if user has update or delete permission
  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: unknown, record: Member) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getMembersColumns;
