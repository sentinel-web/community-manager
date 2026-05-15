import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';
import type { Squad } from '../../api/types/squad';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';
import type { ColumnsFactory, RowClickEvent, SectionPermissions, TranslateFn } from '../section/types';
import TableActions from '../table/body/actions/TableActions';

interface SquadTagsProps {
  squadIds: string[];
}

interface SquadOption {
  value: string;
  label: string;
  raw: { color?: string };
}

export const SquadTags = ({ squadIds }: SquadTagsProps) => {
  const [squadNames, setSquadNames] = useState<SquadOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    Meteor.callAsync('squads.options')
      .then(options => {
        if (cancelled) return;
        const filtered = (options as SquadOption[]).filter(option => squadIds.includes(option.value));
        setSquadNames(filtered);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [squadIds]);

  return (
    <>
      {squadNames.map(squadName => (
        <Tag color={squadName.raw.color} key={squadName.value}>
          <span style={{ color: squadName.raw.color ? getLegibleTextColor(squadName.raw.color) : undefined }}>{squadName.label}</span>
        </Tag>
      ))}
    </>
  );
};

const defaultPermissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true };

const getSquadsColumns: ColumnsFactory<Squad> = (
  handleEdit: (e: RowClickEvent, record: Squad) => void,
  handleDelete: (e: RowClickEvent, record: Squad) => void,
  permissions: SectionPermissions = defaultPermissions,
  t: TranslateFn,
) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<Squad> = [
    {
      title: t('columns.image'),
      dataIndex: 'image',
      key: 'image',
      render: (image: string | undefined) => (image ? <img src={image} alt="squad" width="50" height="50" /> : '-'),
    },
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Squad, b: Squad) => String(a.name).localeCompare(String(b.name)),
      render: (name: string | undefined, record: Squad) =>
        name ? (
          record.color ? (
            <Tag color={record.color}>
              <span style={{ color: getLegibleTextColor(record.color) }}>{name}</span>
            </Tag>
          ) : (
            <Tag>{name}</Tag>
          )
        ) : (
          '-'
        ),
    },
    {
      title: t('columns.shortRangeFrequency'),
      dataIndex: 'shortRangeFrequency',
      key: 'shortRangeFrequency',
      sorter: (a: Squad, b: Squad) => String(a.shortRangeFrequency).localeCompare(String(b.shortRangeFrequency)),
      render: (shortRangeFrequency: string | undefined) => shortRangeFrequency || '-',
    },
    {
      title: t('columns.longRangeFrequency'),
      dataIndex: 'longRangeFrequency',
      key: 'longRangeFrequency',
      sorter: (a: Squad, b: Squad) => String(a.longRangeFrequency).localeCompare(String(b.longRangeFrequency)),
      render: (longRangeFrequency: string | undefined) => longRangeFrequency || '-',
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: 'actions',
      key: 'actions',
      render: (id: unknown, record: Squad) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getSquadsColumns;
