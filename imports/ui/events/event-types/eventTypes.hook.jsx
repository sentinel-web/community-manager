import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import EventTypesCollection from '../../../api/collections/eventTypes.collection';

export default function useEventTypes() {
  const { ready, eventTypes, count } = useTracker(() => {
    const subscription = Meteor.subscribe('eventTypes');
    return {
      ready: subscription.ready(),
      eventTypes: EventTypesCollection.find().fetch(),
      count: EventTypesCollection.find().count(),
    };
  }, []);

  return { ready, eventTypes, count };
}
