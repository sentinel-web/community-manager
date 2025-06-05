import React from 'react';
import TaskStatusCollection from '../../../api/collections/taskStatus.collection';
import Section from '../../section/Section';
import TaskStatusForm from './TaskStatusForm';
import getTaskStatusColumns from './task-status.columns';

const TaskStatuses = () => {
  return (
    <Section
      title="Task Statuses"
      collectionName="taskStatus"
      Collection={TaskStatusCollection}
      FormComponent={TaskStatusForm}
      columnsFactory={getTaskStatusColumns}
      filterFactory={string => ({ name: { $regex: string, $options: 'i' } })}
    />
  );
};

export default TaskStatuses;
