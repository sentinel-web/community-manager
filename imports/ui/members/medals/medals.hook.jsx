import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import MedalsCollection from '../../../api/collections/medals.collection';

export default function useMedals() {
  const { ready, medals, count } = useTracker(() => {
    const subscription = Meteor.subscribe('medals');
    return {
      ready: subscription.ready(),
      medals: MedalsCollection.find().fetch(),
      count: MedalsCollection.find().count(),
    };
  }, []);

  return { ready, medals, count };
}
