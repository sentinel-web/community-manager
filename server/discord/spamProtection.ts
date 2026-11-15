import { Events, PermissionFlagsBits, type Message } from 'discord.js';
import { safe, type BotContext, type StopFn } from './bot';

const WINDOW_MS = 15_000;
const REPEAT_LIMIT = 3;
const TIMEOUT_MS = 5 * 60 * 1000;
const WARNING_VISIBLE_MS = 10_000;
const LINK_PATTERN = /https?:\/\/\S+|www\.\S+|discord\.gg\/\S+/i;

/** Mutes a member who posts the same link-carrying message three times within 15 seconds. */
export async function startSpamProtection({ client, guild, t }: BotContext): Promise<StopFn> {
  const recent = new Map<string, Message[]>();

  client.on(
    Events.MessageCreate,
    safe(async (message: Message) => {
      if (message.guildId !== guild.id || message.author.bot || !message.inGuild()) return;
      if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;
      const content = message.content.trim();
      if (!LINK_PATTERN.test(content)) return;

      const history = [...(recent.get(message.author.id) ?? []), message].filter(entry => message.createdTimestamp - entry.createdTimestamp < WINDOW_MS);
      const repeats = history.filter(entry => entry.content.trim() === content);
      if (repeats.length < REPEAT_LIMIT) {
        recent.set(message.author.id, history);
        return;
      }
      recent.delete(message.author.id);

      await Promise.all(repeats.map(entry => entry.delete().catch(() => undefined)));
      await message.member?.timeout(TIMEOUT_MS, 'Spam protection: repeated link');
      const warning = await message.channel.send({
        content: t('discord.bot.spamTimeout', { user: `<@${message.author.id}>` }),
        allowedMentions: { users: [message.author.id] },
      });
      setTimeout(() => warning.delete().catch(() => undefined), WARNING_VISIBLE_MS);
    })
  );

  return () => recent.clear();
}
