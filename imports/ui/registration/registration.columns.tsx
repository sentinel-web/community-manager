import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import type { Registration } from '../../api/types';
import type { LanguageContextValue } from '../../i18n/LanguageContext';
import type { SectionPermissions } from '../section/types';
import TableActions from '../table/body/actions/TableActions';
import DiscoveryTypeTag from './discovery-types/DiscoveryTypeTag';
import RegistrationExtra from './RegistrationExtra';

type TFn = LanguageContextValue['t'];

export default function getRegistrationColumns(
  handleEdit: (e: React.MouseEvent<HTMLElement>, record: Registration) => void,
  handleDelete: (e: React.MouseEvent<HTMLElement>, record: Registration) => void,
  permissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true },
  t: TFn = k => k,
): ColumnsType<Registration> {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<Registration> = [
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
      sorter: (a, b) => (a.discoveryType ?? '').localeCompare(b.discoveryType ?? ''),
      render: (discoveryType: string) => <DiscoveryTypeTag discoveryTypeId={discoveryType} />,
    },
    {
      title: t('columns.steamProfileLink'),
      dataIndex: 'steamProfileLink',
      key: 'steamProfileLink',
      ellipsis: true,
      render: (link: string | null | undefined) =>
        link ? (
          <a href={link} target="_blank" rel="noopener noreferrer">
            {link}
          </a>
        ) : (
          '-'
        ),
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
      sorter: (a, b) => (a.description ?? '').localeCompare(b.description ?? ''),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (_id: string, record: Registration) => (
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
