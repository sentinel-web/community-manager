import { Tag } from 'antd';
import React from 'react';
import type { ColumnsType } from 'antd/es/table';
import TableActions from '../../table/body/actions/TableActions';
import type { SectionPermissions, TranslateFn, RowClickEvent } from '../../section/types';
import type { EventType } from '../../../api/types/misc';

const getEventTypeColumns = (
  handleEdit: (e: RowClickEvent, record: EventType) => void,
  handleDelete: (e: RowClickEvent, record: EventType) => void,
  permissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true },
  t: TranslateFn = k => k
): ColumnsType<EventType> => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<EventType> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a, b) => (a.description || '').localeCompare(b.description || ''),
    },
    {
      title: t('common.color'),
      dataIndex: 'color',
      key: 'color',
      ellipsis: true,
      sorter: (a, b) => (a.color || '').localeCompare(b.color || ''),
      render: (color: string | null) => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string, record: EventType) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getEventTypeColumns;
