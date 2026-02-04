import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import TableActions from '../table/body/actions/TableActions';
import TaskStatusTag from './task-status/TaskStatusTag';

export const Participants = ({ participants }) => {
  const [value, setValue] = useState('loading...');

  useEffect(() => {
    if (!participants?.length) setValue('-');
    const filter = { _id: { $in: participants } };
    const options = { fields: { 'profile.name': 1, 'profile.id': 1, 'profile.rankId': 1 } };
    Meteor.callAsync('members.participantNames', filter, options)
      .then(res => {
        if (!res?.length) setValue('-');
        else setValue(res);
      })
      .catch(() => {});
  }, [participants]);

  return <>{value}</>;
};
Participants.propTypes = {
  participants: PropTypes.array,
};

const getTaskColumns = (handleTaskEdit, handleTaskDelete, permissions = {}) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns = [
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
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: 'Actions',
      dataIndex: '_id',
      render: (id, record) => (
        <TableActions record={record} handleEdit={handleTaskEdit} handleDelete={handleTaskDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getTaskColumns;
