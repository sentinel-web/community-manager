import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import SettingsCollection from '../../api/collections/settings.collection';

export default function useSettings() {
  const { ready, communityTitle, communityLogo, communityColor } = useTracker(() => {
    const subscription = Meteor.subscribe('settings');
    return {
      ready: subscription.ready(),
      communityTitle: SettingsCollection.findOne({ key: 'community-title' })?.value,
      communityLogo: SettingsCollection.findOne({ key: 'community-logo' })?.value,
      communityColor: SettingsCollection.findOne({ key: 'community-color' })?.value ?? '#708152',
    };
  }, []);
  return { ready, communityTitle, communityLogo, communityColor };
}
