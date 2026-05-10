import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import type { Task } from '../../api/types/task';
import type { LanguageContextValue } from '../../i18n/LanguageContext';
import type { SectionPermissions } from '../section/types';
import TableActions from '../table/body/actions/TableActions';
import TaskStatusTag from './task-status/TaskStatusTag';

type TFn = LanguageContextValue['t'];

interface ParticipantsProps {
  participants?: string[];
}

export function Participants({ participants }: ParticipantsProps) {
  const [value, setValue] = useState<string>('loading...');

  useEffect(() => {
    if (!participants?.length) setValue('-');
    const filter = { _id: { $in: participants } };
    const options = { fields: { 'profile.name': 1, 'profile.id': 1, 'profile.rankId': 1 } };
    Meteor.callAsync('members.participantNames', filter, options)
      .then((res: string) => {
        if (!res?.length) setValue('-');
        else setValue(res);
      })
      .catch(() => {});
  }, [participants]);

  return <>{value}</>;
}

export function getTaskColumns(
  handleTaskEdit: (e: React.MouseEvent<HTMLElement>, record: Task) => void,
  handleTaskDelete: (e: React.MouseEvent<HTMLElement>, record: Task) => void,
  permissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true },
  t: TFn,
): ColumnsType<Task> {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<Task> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      ellipsis: true,
    },
    {
      title: t('tasks.participants'),
      dataIndex: 'participants',
      sorter: (a, b) => (a.participants?.length || 0) - (b.participants?.length || 0),
      render: participants => <Participants participants={participants} />,
      ellipsis: true,
    },
    {
      title: t('tasks.completedBy'),
      dataIndex: 'completedBy',
      sorter: (a, b) => (a.completedBy?.length || 0) - (b.completedBy?.length || 0),
      render: completedBy => <Participants participants={completedBy} />,
      ellipsis: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      sorter: (a, b) => {
        const aStatus = a.status ? TaskStatusCollection.findOne({ _id: a.status })?.name : a.status;
        const bStatus = b.status ? TaskStatusCollection.findOne({ _id: b.status })?.name : b.status;
        return (aStatus ?? '').localeCompare(bStatus ?? '');
      },
      ellipsis: true,
      render: status => (status ? <TaskStatusTag taskStatusId={status} /> : '-'),
    },
    {
      title: t('tasks.createdAt'),
      dataIndex: 'createdAt',
      sorter: (a, b) => new Date(a.createdAt || 0).valueOf() - new Date(b.createdAt || 0).valueOf(),
      render: createdAt => (createdAt ? dayjs(createdAt).format('YYYY-MM-DD') : '-'),
      ellipsis: true,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      render: (id, record) => (
        <TableActions record={record} handleEdit={handleTaskEdit} handleDelete={handleTaskDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
}

export default getTaskColumns;
