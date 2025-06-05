import React from 'react';
import RanksCollection from '../../api/collections/ranks.collection';
import { SquadTags } from '../squads/squads.columns';
import TableActions from '../table/body/actions/TableActions';
import RankTag from './ranks/RankTag';

export default function getMembersColumns(handleEdit, handleDelete) {
  return [
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
    {
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (_id, record) => <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} />,
    },
  ];
}
