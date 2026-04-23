import type { ColumnsType } from 'antd/es/table';
import { Tag } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import type { LogEntry } from '../../api/types/misc';
import type { LanguageContextValue } from '../../i18n/LanguageContext';
import LogTableActions from './LogTableActions';

type TFn = LanguageContextValue['t'];

/**
 * Factory function to generate table columns for logs.
 * @param handleView - Callback function to handle viewing a log entry. Called with (event, record).
 * @param handleDelete - Callback function to handle deleting a log entry. Called with (event, record).
 * @param t - Translation function for i18n.
 * @returns Array of column configuration objects for Ant Design Table.
 */
const getLogsColumns = (
  handleView: (e: React.MouseEvent<HTMLElement>, record: LogEntry) => void,
  handleDelete: (e: React.MouseEvent<HTMLElement>, record: LogEntry) => void,
  t: TFn = k => k
): ColumnsType<LogEntry> => {
  return [
    {
      title: t('columns.timestamp'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      ellipsis: true,
      sorter: (a, b) => new Date(a.timestamp as Date).valueOf() - new Date(b.timestamp as Date).valueOf(),
      defaultSortOrder: 'descend',
      render: (timestamp: Date | undefined) => (timestamp ? dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('columns.action'),
      dataIndex: 'action',
      key: 'action',
      ellipsis: true,
      sorter: (a, b) => (a.action || '').localeCompare(b.action || ''),
      render: (action: string) => <Tag>{action}</Tag>,
    },
    {
      title: t('columns.payload'),
      dataIndex: 'payload',
      key: 'payload',
      ellipsis: true,
      render: (payload: Record<string, unknown> | undefined) => {
        if (!payload) return '-';
        const str = JSON.stringify(payload);
        return str.length > 50 ? `${str.substring(0, 50)}...` : str;
      },
    },
    {
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string | undefined, record: LogEntry) => (
        <LogTableActions record={record} handleView={handleView} handleDelete={handleDelete} />
      ),
    },
  ];
};

export default getLogsColumns;
