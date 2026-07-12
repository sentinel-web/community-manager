import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import SettingsCollection from '../../api/collections/settings.collection';

export interface UseSettingsResult {
  ready: boolean;
  communityTitle?: string;
  communityLogo?: string;
  communityColor: string;
  communityNameBlackList: string[];
  communityIdBlackList: string[];
  discordEnabled: boolean;
  discordBotToken?: string;
  discordServerId?: string;
  discordRecruitmentChannelId?: string;
  discordEventsChannelId?: string;
  discordSpamProtectionEnabled: boolean;
  discordErrorMessage?: string;
}

type MinimalSubscriptionHandle = Pick<Meteor.SubscriptionHandle, 'ready'>;

export default function useSettings(): UseSettingsResult {
  const { 
    ready, communityTitle, communityLogo, communityColor, 
    communityNameBlackList, communityIdBlackList, 
    discordEnabled, discordBotToken, discordServerId,
    discordRecruitmentChannelId, discordEventsChannelId,
    discordSpamProtectionEnabled,
    discordErrorMessage 
  } = useTracker(() => {
    const publicSub = Meteor.subscribe('settings.public');
    const userId = Meteor.userId();
    const privateSub: MinimalSubscriptionHandle = userId ? Meteor.subscribe('settings') : { ready: () => true };
    
    return {
      ready: publicSub.ready() && privateSub.ready(),
      communityTitle: SettingsCollection.findOne({ key: 'community-title' })?.value as string | undefined,
      communityLogo: SettingsCollection.findOne({ key: 'community-logo' })?.value as string | undefined,
      communityColor: (SettingsCollection.findOne({ key: 'community-color' })?.value as string | undefined) ?? '#3b88c3',
      communityNameBlackList: (SettingsCollection.findOne({ key: 'community-name-black-list' })?.value as string[] | undefined) ?? [],
      communityIdBlackList: (SettingsCollection.findOne({ key: 'community-id-black-list' })?.value as string[] | undefined) ?? [],
      discordEnabled: (SettingsCollection.findOne({ key: 'discord-enabled' })?.value as boolean | undefined) ?? false,
      discordBotToken: SettingsCollection.findOne({ key: 'discord-bot-token' })?.value as string | undefined,
      discordServerId: SettingsCollection.findOne({ key: 'discord-server-id' })?.value as string | undefined,
      discordRecruitmentChannelId: SettingsCollection.findOne({ key: 'discord-recruitment-channel-id' })?.value as string | undefined,
      discordEventsChannelId: SettingsCollection.findOne({ key: 'discord-events-channel-id' })?.value as string | undefined,
      discordSpamProtectionEnabled: (SettingsCollection.findOne({ key: 'discord-spam-protection-enabled' })?.value as boolean | undefined) ?? false,
      discordErrorMessage: SettingsCollection.findOne({ key: 'discord-error-message' })?.value as string | undefined,
    };
  }, []);

  return { 
    ready, communityTitle, communityLogo, communityColor, 
    communityNameBlackList, communityIdBlackList, 
    discordEnabled, discordBotToken, discordServerId,
    discordRecruitmentChannelId, discordEventsChannelId,
    discordSpamProtectionEnabled,
    discordErrorMessage 
  };
}