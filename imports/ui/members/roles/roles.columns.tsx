import { Tag } from 'antd';
import React from 'react';
import type { Role } from '../../../api/types/role';
import type { ColumnsFactory } from '../../section/types';
import TableActions from '../../table/body/actions/TableActions';

const getRolesColumns: ColumnsFactory<Role> = (handleEdit, handleDelete, permissions, t) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ReturnType<ColumnsFactory<Role>> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a: Role, b: Role) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a: Role, b: Role) => (a.description || '').localeCompare(b.description || ''),
    },
    {
      title: t('common.color'),
      dataIndex: 'color',
      key: 'color',
      ellipsis: true,
      sorter: (a: Role, b: Role) => (a.color || '').localeCompare(b.color || ''),
      render: (color: string) => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string, record: Role) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getRolesColumns;
