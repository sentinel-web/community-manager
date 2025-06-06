import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import SettingsCollection from '../../api/collections/settings.collection';

export default function useSettings() {
  const { ready, communityTitle, communityLogo, communityColor, communityNameBlackList, communityIdBlackList } = useTracker(() => {
    const subscription = Meteor.subscribe('settings');
    return {
      ready: subscription.ready(),
      communityTitle: SettingsCollection.findOne({ key: 'community-title' })?.value,
      communityLogo: SettingsCollection.findOne({ key: 'community-logo' })?.value,
      communityColor: SettingsCollection.findOne({ key: 'community-color' })?.value ?? '#3b88c3',
      communityNameBlackList: SettingsCollection.findOne({ key: 'community-name-black-list' })?.value ?? [],
      communityIdBlackList: SettingsCollection.findOne({ key: 'community-id-black-list' })?.value ?? [],
    };
  }, []);
  return { ready, communityTitle, communityLogo, communityColor, communityNameBlackList, communityIdBlackList };
}
