import { Tag } from 'antd';
import React from 'react';
import type { Position } from '../../../api/types/misc';
import type { ColumnsFactory } from '../../section/types';
import TableActions from '../../table/body/actions/TableActions';

// Position in the DB has an optional numeric order field not captured in the shared ColoredEntity alias
export interface PositionDoc extends Position {
  order?: number;
}

const getPositionColumns: ColumnsFactory<PositionDoc> = (handleEdit, handleDelete, permissions, t) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ReturnType<ColumnsFactory<PositionDoc>> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a: PositionDoc, b: PositionDoc) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: t('positions.order'),
      dataIndex: 'order',
      key: 'order',
      ellipsis: true,
      sorter: (a: PositionDoc, b: PositionDoc) => (a.order || 0) - (b.order || 0),
    },
    {
      title: t('common.color'),
      dataIndex: 'color',
      key: 'color',
      ellipsis: true,
      sorter: (a: PositionDoc, b: PositionDoc) => (a.color || '').localeCompare(b.color || ''),
      render: (color: string) => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a: PositionDoc, b: PositionDoc) => (a.description || '').localeCompare(b.description || ''),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string, record: PositionDoc) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getPositionColumns;
