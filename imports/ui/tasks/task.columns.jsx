import React, { useEffect } from 'react';
import TableActions from '../table/body/actions/TableActions';
import { Meteor } from 'meteor/meteor';
import TaskStatusTag from './task-status/TaskStatusTag';

export const Participants = ({ participants }) => {
  const [value, setValue] = React.useState('loading...');

  useEffect(() => {
    if (!participants?.length) setValue('-');
    const filter = { _id: { $in: participants } };
    const options = { fields: { 'profile.name': 1, 'profile.id': 1, 'profile.rankId': 1 } };
    Meteor.callAsync('members.find', filter, options)
      .then(res => {
        if (!res?.length) setValue('-');
        else setValue(res.map(member => `${member.profile.rankId || ''} ${member.profile.id || '0000'}-${member.profile.name || 'Name'}`).join(', '));
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
      sorter: (a, b) => (a.status || '').localeCompare(b.status || ''),
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
