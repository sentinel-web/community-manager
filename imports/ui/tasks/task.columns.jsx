import React, { useEffect } from 'react';
import TableActions from '../table/body/actions/TableActions';
import { Meteor } from 'meteor/meteor';
import TaskStatusTag from './task-status/TaskStatusTag';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';

export const Participants = ({ participants }) => {
  const [value, setValue] = React.useState('loading...');

  useEffect(() => {
    if (!participants?.length) setValue('-');
    const filter = { _id: { $in: participants } };
    const options = { fields: { 'profile.name': 1, 'profile.id': 1, 'profile.rankId': 1 } };
    Meteor.callAsync('members.participantNames', filter, options)
      .then(res => {
        if (!res?.length) setValue('-');
        else setValue(res);
      })
      .catch(error => console.error(error));
  }, [participants]);

  return <>{value}</>;
};

const getTaskColumns = (handleTaskEdit, handleTaskDelete) => {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      ellipsis: true,
    },
    {
      title: 'Participants',
      dataIndex: 'participants',
      sorter: (a, b) => (a.participants?.length || 0) - (b.participants?.length || 0),
      render: participants => <Participants participants={participants} />,
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      sorter: (a, b) => {
        const aStatus = a.status ? TaskStatusCollection.findOne({ _id: a.status })?.name : a.status;
        const bStatus = b.status ? TaskStatusCollection.findOne({ _id: b.status })?.name : b.status;
        return aStatus.localeCompare(bStatus);
      },
      ellipsis: true,
      render: status => (status ? <TaskStatusTag taskStatusId={status} /> : '-'),
    },
    {
      title: 'Actions',
      dataIndex: '_id',
      render: (id, record) => <TableActions record={record} handleEdit={handleTaskEdit} handleDelete={handleTaskDelete} />,
    },
  ];
};

export { getTaskColumns };
