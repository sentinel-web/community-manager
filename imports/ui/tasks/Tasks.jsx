import { Button } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useContext } from 'react';
import TasksCollection from '../../api/collections/tasks.collection';
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

  const openFilterDrawer = useCallback(
    e => {
      e.preventDefault();
      drawer.setDrawerTitle('Filter Tasks');
      drawer.setDrawerModel(filter);
      drawer.setDrawerComponent(<TaskFilter setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerExtra(empty);
      drawer.setDrawerOpen(true);
    },
    [drawer, filter]
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
      title="Tasks"
      collectionName="tasks"
      Collection={TasksCollection}
      FormComponent={TaskForm}
      columnsFactory={getTaskColumns}
      customView={filter?.type === 'kanban' ? KanbanBoard : false}
      headerExtra={<Button onClick={openFilterDrawer}>Filter</Button>}
      filterFactory={filterFactory}
    />
  );
}
