import { Tag } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import LogTableActions from './LogTableActions';

/**
 * Factory function to generate table columns for logs.
 * @param {function} handleView - Callback function to handle viewing a log entry. Called with (event, record).
 * @param {function} handleDelete - Callback function to handle deleting a log entry. Called with (event, record).
 * @param {function} [t=k=>k] - Translation function for i18n.
 * @returns {Array} Array of column configuration objects for Ant Design Table.
 */
const getLogsColumns = (handleView, handleDelete, t = k => k) => {
  return [
    {
      title: t('columns.timestamp'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      ellipsis: true,
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      defaultSortOrder: 'descend',
      render: timestamp => (timestamp ? dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('columns.action'),
      dataIndex: 'action',
      key: 'action',
      ellipsis: true,
      sorter: (a, b) => (a.action || '').localeCompare(b.action || ''),
      render: action => <Tag>{action}</Tag>,
    },
    {
      title: t('columns.payload'),
      dataIndex: 'payload',
      key: 'payload',
      ellipsis: true,
      render: payload => {
        if (!payload) return '-';
        const str = JSON.stringify(payload);
        return str.length > 50 ? `${str.substring(0, 50)}...` : str;
      },
    },
    {
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => <LogTableActions record={record} handleView={handleView} handleDelete={handleDelete} />,
    },
  ];
};

export default getLogsColumns;
