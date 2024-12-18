import { Tag } from 'antd';
import React from 'react';

const getRankColumns = () => {
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
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      ellipsis: true,
      sorter: (a, b) => (a.color || '').localeCompare(b.color || ''),
      render: color => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
  ];
};

export default getRankColumns;
