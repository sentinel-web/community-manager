import React from 'react';
import TaskStatusCollection from '../../../api/collections/taskStatus.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import Section from '../../section/Section';
import TaskStatusForm from './TaskStatusForm';
import getTaskStatusColumns from './task-status.columns';

const TaskStatuses = () => {
  const { t } = useTranslation();

  return (
    <Section
      title={t('tasks.taskStatuses')}
      collectionName="taskStatus"
      Collection={TaskStatusCollection}
      FormComponent={TaskStatusForm}
      columnsFactory={getTaskStatusColumns}
      filterFactory={string => ({ name: { $regex: string, $options: 'i' } })}
    />
  );
};

export default TaskStatuses;
