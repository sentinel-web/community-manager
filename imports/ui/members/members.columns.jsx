import React from 'react';
import TableActions from '../table/body/actions/TableActions';
import RanksCollection from '../../api/collections/ranks.collection';
import RankTag from './ranks/RankTag';
import { SquadTags } from '../squads/squads.columns';

export default function getMembersColumns(handleDelete, handleEdit) {
  return [
    {
      title: 'Squad',
      dataIndex: 'squadId',
      key: 'squadId',
      ellipsis: true,
      sorter: (a, b) => String(a.squadId).localeCompare(String(b.squadId)),
      render: squadId => (squadId ? <SquadTags squadIds={[squadId]} /> : '-'),
    },
    {
      title: 'Rank',
      dataIndex: 'rankId',
      key: 'rankId',
      ellipsis: true,
      sorter: (a, b) => {
        const rankA = a.rankId ? RanksCollection.findOne({ _id: a.rankId })?.name : a.rank || '-';
        const rankB = b.rankId ? RanksCollection.findOne({ _id: b.rankId })?.name : b.rank || '-';
        return rankA.localeCompare(rankB);
      },
      render: rankId => <RankTag rankId={rankId} />,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      sorter: (a, b) => String(a.id).localeCompare(String(b.id)),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => String(a.name).localeCompare(String(b.name)),
    },
    {
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} />,
    },
  ];
}
