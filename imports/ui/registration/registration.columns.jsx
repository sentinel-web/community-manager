import React from 'react';
import TableActions from '../table/body/actions/TableActions';
import DiscoveryTypeTag from './discovery-types/DiscoveryTypeTag';
import RegistrationExtra from './RegistrationExtra';

export default function getRegistrationColumns(handleEdit, handleDelete, permissions = {}, t = k => k) {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('columns.id'),
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => String(a.id).localeCompare(String(b.id)),
    },
    {
      title: t('columns.age'),
      dataIndex: 'age',
      key: 'age',
      sorter: (a, b) => a.age - b.age,
    },
    {
      title: t('columns.discoveryType'),
      dataIndex: 'discoveryType',
      key: 'discoveryType',
      sorter: (a, b) => a.discoveryType.localeCompare(b.discoveryType),
      render: discoveryType => <DiscoveryTypeTag discoveryTypeId={discoveryType} />,
    },
    {
      title: t('columns.steamProfileLink'),
      dataIndex: 'steamProfileLink',
      key: 'steamProfileLink',
      ellipsis: true,
      render: link => (link ? <a href={link} target="_blank" rel="noopener noreferrer">{link}</a> : '-'),
    },
    {
      title: t('columns.discordTag'),
      dataIndex: 'discordTag',
      key: 'discordTag',
      ellipsis: true,
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a, b) => a.description.localeCompare(b.description),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => (
        <TableActions
          record={record}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          extra={RegistrationExtra}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      ),
    });
  }

  return columns;
}
