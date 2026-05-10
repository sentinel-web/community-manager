import { Tag } from 'antd';
import React from 'react';
import type { ColumnsType } from 'antd/es/table';
import TableActions from '../../table/body/actions/TableActions';
import type { SectionPermissions, TranslateFn, RowClickEvent } from '../../section/types';
import type { DiscoveryType } from '../../../api/types/misc';

export default function getDiscoveryTypeColumns(
  handleEdit: (e: RowClickEvent, record: DiscoveryType) => void,
  handleDelete: (e: RowClickEvent, record: DiscoveryType) => void,
  permissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true },
  t: TranslateFn,
): ColumnsType<DiscoveryType> {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<DiscoveryType> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
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
      sorter: (a, b) => (a.color || '').localeCompare(b.color || ''),
      render: (color: string | null) => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string, record: DiscoveryType) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
}
