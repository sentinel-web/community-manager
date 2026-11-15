import { ChannelType } from 'discord.js';
import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { DISCORD_CONFIG_DEFAULTS, DISCORD_CONFIG_KEYS, DISCORD_SNOWFLAKE, DISCORD_TOKEN_KEY } from '../../imports/api/discord/settings';
import { locales } from '../../imports/i18n';
import { getDiscordContext, startDiscordBot, type BotContext } from '../discord/bot';
import { createLinkCode, linkMembersByTag, syncAllMembers } from '../discord/memberSync';
import { encrypt } from '../encryption';
import { checkPermission, validateObject, validateString, validateUserId } from '../main';
import { createLog } from './logs.server';

// Modules whose forms map an entity to a Discord role and therefore need the guild's role list.
const ROLE_MAPPING_MODULES = ['ranks', 'roles', 'specializations', 'squads'] as const;

async function requireSettingsPermission(userId: string | null): Promise<void> {
  validateUserId(userId);
  if (!(await checkPermission(userId, 'settings'))) throw new Meteor.Error(403, 'Permission denied');
}

function requireContext(): BotContext {
  const context = getDiscordContext();
  if (!context) throw new Meteor.Error('discord-offline', 'The Discord bot is not connected');
  return context;
}

function validateConfigValue(key: string, value: unknown): void {
  const expected = typeof DISCORD_CONFIG_DEFAULTS[key as keyof typeof DISCORD_CONFIG_DEFAULTS];
  const valid =
    typeof value === expected &&
    (!key.endsWith('-id') || value === '' || DISCORD_SNOWFLAKE.test(value as string)) &&
    (key !== 'discord-language' || Object.keys(locales).includes(value as string));
  if (!valid) throw new Meteor.Error(400, `Invalid value for ${key}`);
}

if (Meteor.isServer) {
  Meteor.methods({
    /**
     * Saves the Discord configuration as a whole and restarts the bot once. `token` is optional:
     * omitted or empty keeps the stored one. The token is stored encrypted and is never sent back.
     */
    'discord.configure': async function (config: Record<string, unknown> = {}, token?: string) {
      await requireSettingsPermission(this.userId);
      validateObject(config, false);
      validateString(token, true);
      const entries = Object.entries(config);
      for (const [key, value] of entries) {
        if (!DISCORD_CONFIG_KEYS.includes(key as never)) throw new Meteor.Error(400, `Unknown Discord setting ${key}`);
        validateConfigValue(key, value);
      }
      if (token) entries.push([DISCORD_TOKEN_KEY, encrypt(token.trim())]);
      await Promise.all(entries.map(([key, value]) => SettingsCollection.upsertAsync({ key }, { $set: { key, value } })));
      await createLog('settings.updated', { key: 'discord', keys: entries.map(([key]) => key) });
      await startDiscordBot();
    },
    /** Roles and text channels of the connected guild for the selects, or `null` while the bot is offline. */
    'discord.guild': async function () {
      validateUserId(this.userId);
      const allowed = await Promise.all([
        checkPermission(this.userId, 'settings'),
        ...ROLE_MAPPING_MODULES.flatMap(module => [checkPermission(this.userId, module, 'create'), checkPermission(this.userId, module, 'update')]),
      ]);
      if (!allowed.some(Boolean)) throw new Meteor.Error(403, 'Permission denied');
      const context = getDiscordContext();
      if (!context) return null;
      const [roles, channels] = await Promise.all([context.guild.roles.fetch(), context.guild.channels.fetch()]);
      return {
        // Managed roles belong to integrations and @everyone is implicit; neither can be assigned.
        roles: roles
          .filter(role => !role.managed && role.id !== context.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(role => ({ value: role.id, label: role.name })),
        channels: channels
          .filter(channel => channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement)
          .map(channel => ({ value: channel!.id, label: `#${channel!.name}` })),
      };
    },
    /** Pushes the web state (ranks, roles, squads, specializations) of every linked member to Discord. */
    'discord.syncMembers': async function (): Promise<number> {
      await requireSettingsPermission(this.userId);
      const context = requireContext();
      // Through the bot's queue, so it cannot interleave with a change-driven sync of the same member.
      const count = await new Promise<number>((resolve, reject) => context.enqueue(() => syncAllMembers(context).then(resolve, reject)));
      await createLog('discord.membersSynced', { userId: this.userId, count });
      return count;
    },
    /** Links unlinked members whose stored Discord username matches a guild member. See linkMembersByTag. */
    'discord.linkByTag': async function (): Promise<number> {
      await requireSettingsPermission(this.userId);
      const count = await linkMembersByTag(requireContext());
      await createLog('discord.linkedByTag', { userId: this.userId, count });
      return count;
    },
    /** One-time code the caller redeems with `/link` in Discord to link their own account. */
    'discord.createLinkCode': async function (): Promise<string> {
      validateUserId(this.userId);
      return createLinkCode(this.userId);
    },
    /** Removes the Discord link of the caller, or of another member for callers who may update members. */
    'discord.unlink': async function (memberId?: string) {
      validateUserId(this.userId);
      validateString(memberId, true);
      const targetId = memberId || this.userId;
      if (targetId !== this.userId && !(await checkPermission(this.userId, 'members', 'update'))) {
        throw new Meteor.Error(403, 'Permission denied');
      }
      await MembersCollection.updateAsync(targetId, { $unset: { 'profile.discordId': '' } });
      await createLog('discord.unlinked', { id: targetId, userId: this.userId });
    },
  });
}
