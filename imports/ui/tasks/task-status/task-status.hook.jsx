import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import TaskStatusCollection from '../../../api/collections/taskStatus.collection';

export default function useTaskStatus() {
  const { ready, taskStatus, count } = useTracker(() => {
    const subscription = Meteor.subscribe('taskStatus');
    return {
      ready: subscription.ready(),
      taskStatus: TaskStatusCollection.find().fetch(),
      count: TaskStatusCollection.find().count(),
    };
  }, []);
  return { ready, taskStatus, count };
}
