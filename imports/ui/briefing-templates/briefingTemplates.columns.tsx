import { Tag } from 'antd';
import React from 'react';
import type { ColumnsType } from 'antd/es/table';
import TableActions from '../table/body/actions/TableActions';
import type { SectionPermissions, TranslateFn, RowClickEvent } from '../section/types';
import type { BriefingTemplate } from '../../api/types';

const getBriefingTemplateColumns = (
  handleEdit: (e: RowClickEvent, record: BriefingTemplate) => void,
  handleDelete: (e: RowClickEvent, record: BriefingTemplate) => void,
  permissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true },
  t: TranslateFn
): ColumnsType<BriefingTemplate> => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<BriefingTemplate> = [
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
      render: (_id: string, record: BriefingTemplate) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getBriefingTemplateColumns;
