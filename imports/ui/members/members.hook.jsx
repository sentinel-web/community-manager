import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import MembersCollection from '../../api/collections/members.collection';
import { Meteor } from 'meteor/meteor';

export default function useMembers() {
  const { ready, members, count } = useTracker(() => {
    const subscription = Meteor.subscribe('members');
    return {
      ready: subscription.ready(),
      members: MembersCollection.find().fetch(),
      count: MembersCollection.find().count(),
    };
  }, []);

  return { ready, members, count };
}
