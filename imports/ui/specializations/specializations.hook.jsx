import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import SpecializationsCollection from '../../api/collections/specializations.collection';

export default function useSpecializations() {
  const { ready, specializations, count } = useTracker(() => {
    const subscription = Meteor.subscribe('specializations');
    return {
      ready: subscription.ready(),
      specializations: SpecializationsCollection.find().fetch(),
      count: SpecializationsCollection.find().count(),
    };
  }, []);

  return { ready, specializations, count };
}
