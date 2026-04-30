import { Button } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Mongo } from 'meteor/mongo';
import React, { useCallback, useContext } from 'react';
import TasksCollection from '../../api/collections/tasks.collection';
import type { Task } from '../../api/types/task';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import type { DrawerContextValue } from '../app/types';
import Section from '../section/Section';
import { useTourRef } from '../tour/TourContext';
import KanbanBoard from './KanbanBoard';
import { getTaskColumns } from './task.columns';
import TaskFilter from './TaskFilter';
import TaskForm from './TaskForm';
import type { TaskFilterModel } from './types';

const empty = <></>;

export default function Tasks() {
  const tasksRef = useTourRef('tasks-section');
  const filter = useTracker(() => Meteor.user()?.profile?.taskFilter as TaskFilterModel | undefined, []);
  const drawer = useContext(DrawerContext) as DrawerContextValue;
  const { t } = useTranslation();

  const openFilterDrawer = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drawer.setDrawerTitle(t('tasks.filterTasks'));
      drawer.setDrawerModel(filter as unknown as Record<string, unknown>);
      drawer.setDrawerComponent(<TaskFilter setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerExtra(empty);
      drawer.setDrawerOpen(true);
    },
    [drawer, filter, t]
  );

  const filterFactory = useCallback(
    (string: string): Mongo.Selector<Task> => {
      const newFilter: Mongo.Selector<Task> = {
        status: { $in: filter?.status || [] },
      };
      if (string) (newFilter as Record<string, unknown>).name = { $regex: string, $options: 'i' };
      if (filter?.participants?.length) (newFilter as Record<string, unknown>).participants = { $in: filter.participants };
      return newFilter;
    },
    [filter]
  );

  return (
    <div ref={tasksRef as React.RefObject<HTMLDivElement>}>
      <Section<Task>
        title={t('tasks.title')}
        collectionName="tasks"
        Collection={TasksCollection}
        FormComponent={TaskForm}
        columnsFactory={getTaskColumns}
        customView={filter?.type === 'kanban' ? KanbanBoard : false}
        headerExtra={<Button onClick={openFilterDrawer}>{t('tasks.filter')}</Button>}
        filterFactory={filterFactory}
      />
    </div>
  );
}
