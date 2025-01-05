import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import SquadsCollection from '../../api/collections/squads.collection';

export default function useSquads() {
  const { ready, squads, count } = useTracker(() => {
    const subscription = Meteor.subscribe('squads');
    return {
      ready: subscription.ready(),
      squads: SquadsCollection.find().fetch(),
      count: SquadsCollection.find().count(),
    };
  }, []);

  return { ready, squads, count };
}
