import React from 'react';
import TableActions from '../table/body/actions/TableActions';
import RanksCollection from '../../api/collections/ranks.collection';
import RankTag from './ranks/RankTag';

export default function getMembersColumns(handleDelete, handleEdit) {
  return [
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
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => String(a.name).localeCompare(String(b.name)),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      sorter: (a, b) => String(a.id).localeCompare(String(b.id)),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a, b) => String(a.description).localeCompare(String(b.description)),
    },
    {
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} />,
    },
  ];
}
