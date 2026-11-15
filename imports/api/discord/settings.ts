/** Settings keys of the Discord integration. All are written through `discord.configure`. */
export const DISCORD_TOKEN_KEY = 'discord-bot-token';
export const DISCORD_STATUS_KEY = 'discord-status';

/** Never published to, or readable by, any client. */
export const DISCORD_SECRET_KEYS: readonly string[] = [DISCORD_TOKEN_KEY];

export const DISCORD_SNOWFLAKE = /^\d{17,20}$/;

/** The non-secret configuration, as stored (one settings document per key) and as edited in the form. */
export interface DiscordConfig {
  'discord-enabled': boolean;
  'discord-server-id': string;
  'discord-events-channel-id': string;
  'discord-recruitment-channel-id': string;
  'discord-recruitment-threads': boolean;
  'discord-inbound-role-sync': boolean;
  'discord-task-notifications': boolean;
  'discord-spam-protection-enabled': boolean;
  'discord-language': 'en' | 'de' | 'fr';
}

export const DISCORD_CONFIG_DEFAULTS: DiscordConfig = {
  'discord-enabled': false,
  'discord-server-id': '',
  'discord-events-channel-id': '',
  'discord-recruitment-channel-id': '',
  'discord-recruitment-threads': true,
  'discord-inbound-role-sync': true,
  'discord-task-notifications': false,
  'discord-spam-protection-enabled': false,
  'discord-language': 'en',
};

export type DiscordConfigKey = keyof DiscordConfig;
export const DISCORD_CONFIG_KEYS = Object.keys(DISCORD_CONFIG_DEFAULTS) as DiscordConfigKey[];

export interface DiscordStatus {
  state: 'disabled' | 'connecting' | 'connected' | 'error';
  tokenSet: boolean;
  botTag?: string;
  guildName?: string;
  error?: string;
}

interface DiscordOption {
  value: string;
  label: string;
}

/** Result of `discord.guild`: what the selects offer while the bot is connected. */
export interface DiscordGuild {
  roles: DiscordOption[];
  channels: DiscordOption[];
}
