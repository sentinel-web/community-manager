import React from 'react';
import TableActions from '../../table/body/actions/TableActions';
import { Tag } from 'antd';

export default function getDiscoveryTypeColumns(handleDelete, handleEdit) {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a, b) => a.description.localeCompare(b.description),
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      sorter: (a, b) => a.color.localeCompare(b.color),
      render: color => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
    {
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} />,
    },
  ];
}
