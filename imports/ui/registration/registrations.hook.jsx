import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import RegistrationsCollection from "../../api/collections/registrations.collection";

export default function useRegistrations() {
  const { ready, registrations, count } = useTracker(() => {
    const subscription = Meteor.subscribe("registrations");
    return {
      ready: subscription.ready(),
      registrations: RegistrationsCollection.find().fetch(),
      count: RegistrationsCollection.find().count(),
    };
  }, []);
  return { ready, registrations, count };
}
