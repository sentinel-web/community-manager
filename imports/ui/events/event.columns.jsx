import React from 'react';
import TableActions from '../table/body/actions/TableActions';

const getEventColumns = (handleEdit, handleDelete, permissions = {}) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns = [
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
  ];

  // Only add Actions column if user has update or delete permission
  if (canUpdate || canDelete) {
    columns.push({
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getEventColumns;
