import { Button } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useContext } from 'react';
import TasksCollection from '../../api/collections/tasks.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import Section from '../section/Section';
import KanbanBoard from './KanbanBoard';
import { getTaskColumns } from './task.columns';
import TaskFilter from './TaskFilter';
import TaskForm from './TaskForm';

const empty = <></>;

export default function Tasks() {
  const filter = useTracker(() => Meteor.user()?.profile?.taskFilter, []);
  const drawer = useContext(DrawerContext);
  const { t } = useTranslation();

  const openFilterDrawer = useCallback(
    e => {
      e.preventDefault();
      drawer.setDrawerTitle(t('tasks.filterTasks'));
      drawer.setDrawerModel(filter);
      drawer.setDrawerComponent(<TaskFilter setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerExtra(empty);
      drawer.setDrawerOpen(true);
    },
    [drawer, filter, t]
  );

  const filterFactory = useCallback(
    string => {
      const newFilter = {
        status: { $in: filter?.status || [] },
      };
      if (string) newFilter.name = { $regex: string, $options: 'i' };
      if (filter?.participants?.length) newFilter.participants = { $in: filter.participants };
      return newFilter;
    },
    [filter]
  );

  return (
    <Section
      title={t('tasks.title')}
      collectionName="tasks"
      Collection={TasksCollection}
      FormComponent={TaskForm}
      columnsFactory={getTaskColumns}
      customView={filter?.type === 'kanban' ? KanbanBoard : false}
      headerExtra={<Button onClick={openFilterDrawer}>{t('tasks.filter')}</Button>}
      filterFactory={filterFactory}
    />
  );
}
