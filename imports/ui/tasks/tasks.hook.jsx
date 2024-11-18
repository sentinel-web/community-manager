import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import TasksCollection from '../../api/collections/tasks.collection';
import { Meteor } from 'meteor/meteor';

export default function useTasks() {
  const { ready, tasks, count } = useTracker(() => {
    const subscription = Meteor.subscribe('tasks');
    return {
      ready: subscription.ready(),
      tasks: TasksCollection.find().fetch(),
      count: TasksCollection.find().count(),
    };
  }, []);

  return { ready, tasks, count };
}
