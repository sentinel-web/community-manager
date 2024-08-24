import React from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import SettingsCollection from "../../api/collections/settings.collection";

export default function useSettings() {
  const { ready, communityTitle, communityLogo } = useTracker(() => {
    const subscription = Meteor.subscribe("settings");
    return {
      ready: subscription.ready(),
      communityTitle: SettingsCollection.findOne({ key: "community-title" })
        ?.value,
      communityLogo: SettingsCollection.findOne({ key: "community-logo" })
        ?.value,
    };
  }, []);
  return { ready, communityTitle, communityLogo };
}
