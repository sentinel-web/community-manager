import { Tag } from 'antd';
import React from 'react';
import type { Position } from '../../../api/types/misc';
import type { ColumnsFactory } from '../../section/types';
import TableActions from '../../table/body/actions/TableActions';

const getPositionColumns: ColumnsFactory<Position> = (handleEdit, handleDelete, permissions, t) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ReturnType<ColumnsFactory<Position>> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a: Position, b: Position) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: t('positions.order'),
      dataIndex: 'order',
      key: 'order',
      ellipsis: true,
      sorter: (a: Position, b: Position) => (a.order || 0) - (b.order || 0),
    },
    {
      title: t('common.color'),
      dataIndex: 'color',
      key: 'color',
      ellipsis: true,
      sorter: (a: Position, b: Position) => (a.color || '').localeCompare(b.color || ''),
      render: (color: string) => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a: Position, b: Position) => (a.description || '').localeCompare(b.description || ''),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string, record: Position) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getPositionColumns;
