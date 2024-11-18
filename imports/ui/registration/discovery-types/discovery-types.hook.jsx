import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import DiscoveryTypesCollection from '../../../api/collections/discoveryTypes.collection';

export default function useDiscoveryTypes() {
  const { ready, discoveryTypes, count } = useTracker(() => {
    const subscription = Meteor.subscribe('discoveryTypes');
    return {
      ready: subscription.ready(),
      discoveryTypes: DiscoveryTypesCollection.find().fetch(),
      count: DiscoveryTypesCollection.find().count(),
    };
  }, []);
  return { ready, discoveryTypes, count };
}
