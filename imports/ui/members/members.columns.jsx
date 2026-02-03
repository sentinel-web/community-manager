import React from 'react';
import RanksCollection from '../../api/collections/ranks.collection';
import { SquadTags } from '../squads/squads.columns';
import TableActions from '../table/body/actions/TableActions';
import RankTag from './ranks/RankTag';

/**
 * Factory function to generate table columns for members.
 * @param {function} handleEdit - Callback function to handle editing a member. Called with (event, record).
 * @param {function} handleDelete - Callback function to handle deleting a member. Called with (event, record).
 * @param {object} [permissions={}] - Permission flags for the current user.
 * @param {boolean} [permissions.canUpdate=true] - Whether the user can update members.
 * @param {boolean} [permissions.canDelete=true] - Whether the user can delete members.
 * @returns {Array} Array of column configuration objects for Ant Design Table.
 */
export default function getMembersColumns(handleEdit, handleDelete, permissions = {}) {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns = [
    {
      title: 'Squad',
      dataIndex: 'profile.squadId',
      key: 'profile.squadId',
      ellipsis: true,
      sorter: (a, b) => String(a.profile.squadId).localeCompare(String(b.profile.squadId)),
      render: (squadId, record) => (record?.profile?.squadId ? <SquadTags squadIds={[record.profile.squadId]} /> : '-'),
    },
    {
      title: 'Rank',
      dataIndex: 'rankId',
      key: 'profile.rankId',
      ellipsis: true,
      sorter: (a, b) => {
        const rankA = a.profile?.rankId ? RanksCollection.findOne({ _id: a.profile.rankId })?.name : a.profile.rank || '-';
        const rankB = b.profile?.rankId ? RanksCollection.findOne({ _id: b.profile.rankId })?.name : b.profile.rank || '-';
        return rankA.localeCompare(rankB);
      },
      render: (rankId, record) => <RankTag rankId={record.profile?.rankId} />,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'profile.id',
      ellipsis: true,
      sorter: (a, b) => String(a.profile.id).localeCompare(String(b.profile.id)),
      render: (id, record) => (record.profile?.id ? record.profile.id : '-'),
    },
    {
      title: 'Name',
      dataIndex: 'profile.name',
      key: 'profile.name',
      ellipsis: true,
      sorter: (a, b) => String(a.profile.name).localeCompare(String(b.profile.name)),
      render: (name, record) => (record.profile?.name ? record.profile.name : '-'),
    },
  ];

  // Only add Actions column if user has update or delete permission
  if (canUpdate || canDelete) {
    columns.push({
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (_id, record) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
}
