import React from 'react';
import TableActions from '../table/body/actions/TableActions';

export default function getMembersColumns(handleDelete, handleEdit) {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => String(a.name).localeCompare(String(b.name)),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
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
