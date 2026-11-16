import { useEffect } from 'react';
import type { DiscordGuild } from '/imports/api/discord/settings';
import useMethod from './useMethod';

/**
 * Roles and channels of the connected Discord server, or `null` while the bot is offline
 * or the caller may not see them. Refetched whenever `refreshKey` changes.
 */
export default function useDiscordGuild(refreshKey?: unknown): DiscordGuild | null {
  const { call, data } = useMethod<DiscordGuild | null>('discord.guild', { notify: false });
  useEffect(() => {
    void call();
  }, [call, refreshKey]);
  return data;
}
