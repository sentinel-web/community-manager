import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import RanksCollection from '../../../api/collections/ranks.collection';

export default function useRanks() {
  const { ready, ranks, count } = useTracker(() => {
    const subscription = Meteor.subscribe('ranks');
    return {
      ready: subscription.ready(),
      ranks: RanksCollection.find().fetch(),
      count: RanksCollection.find().count(),
    };
  }, []);
  return { ready, ranks, count };
}
