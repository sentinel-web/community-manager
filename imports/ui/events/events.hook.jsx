import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import EventsCollection from '../../api/collections/events.collection';
import { Meteor } from 'meteor/meteor';

export default function useEvents() {
  const { ready, events, count } = useTracker(() => {
    const subscription = Meteor.subscribe('events');
    return {
      ready: subscription.ready(),
      events: EventsCollection.find().fetch(),
      count: EventsCollection.find().count(),
    };
  }, []);

  return { ready, events, count };
}
