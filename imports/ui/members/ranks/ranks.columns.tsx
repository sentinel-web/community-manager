import { Tag } from 'antd';
import React from 'react';
import type { Rank } from '../../../api/types/rank';
import type { ColumnsFactory } from '../../section/types';
import TableActions from '../../table/body/actions/TableActions';

const getRankColumns: ColumnsFactory<Rank> = (handleEdit, handleDelete, permissions, t) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ReturnType<ColumnsFactory<Rank>> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: t('columns.type'),
      dataIndex: 'type',
      key: 'type',
      ellipsis: true,
      sorter: (a: Rank, b: Rank) => (a.type || '').localeCompare(b.type || ''),
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          player: t('columns.player'),
          zeus: t('columns.zeus'),
        };
        return <Tag>{typeMap[type] || type}</Tag>;
      },
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a: Rank, b: Rank) => (a.description || '').localeCompare(b.description || ''),
    },
    {
      title: t('common.color'),
      dataIndex: 'color',
      key: 'color',
      ellipsis: true,
      sorter: (a: Rank, b: Rank) => (a.color || '').localeCompare(b.color || ''),
      render: (color: string) => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
    {
      title: t('members.discordRole'),
      dataIndex: 'discordRoleId',
      key: 'discordRoleId',
      ellipsis: true,
      render: (discordRoleId: string) => discordRoleId ? <Tag color="blue">ID: {discordRoleId}</Tag> : <i>-</i>,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string, record: Rank) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getRankColumns;
