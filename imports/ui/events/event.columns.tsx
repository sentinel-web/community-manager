import React from 'react';
import type { ColumnsType } from 'antd/es/table';
import TableActions from '../table/body/actions/TableActions';
import type { SectionPermissions, TranslateFn, RowClickEvent } from '../section/types';
import type { EventDoc } from '../../api/types/event';

const getEventColumns = (
  handleEdit: (e: RowClickEvent, record: EventDoc) => void,
  handleDelete: (e: RowClickEvent, record: EventDoc) => void,
  permissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true },
  t: TranslateFn,
): ColumnsType<EventDoc> => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<EventDoc> = [
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
  ];

  // Only add Actions column if user has update or delete permission
  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string, record: EventDoc) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getEventColumns;
