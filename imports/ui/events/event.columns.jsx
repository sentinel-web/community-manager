import React from 'react';
import TableActions from '../table/body/actions/TableActions';

const getEventColumns = (handleEdit, handleDelete) => {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a, b) => (a.description || '').localeCompare(b.description || ''),
    },
    {
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} />,
    },
  ];
};

export default getEventColumns;
