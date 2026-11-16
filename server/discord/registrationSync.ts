import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import MembersCollection from '../../imports/api/collections/members.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import type { Registration } from '../../imports/api/types';
import { fetchTextChannel, observeLive, type BotContext, type StopFn } from './bot';

// The application form is public: its values are untyped, attacker-controlled text. Escaped so they
// cannot render as masked links or formatting, and never empty (an embed field needs content).
const text = (value: unknown): string => escapeMarkdown(String(value ?? '')).slice(0, 1024) || '-';

/**
 * Posts each new application to the recruitment channel (optionally with a discussion thread)
 * and marks the post once the application is accepted or removed in the web app.
 * Only the name, the requested id and the Discord username are posted — never age or Steam profile.
 */
export async function startRegistrationSync(context: BotContext): Promise<StopFn> {
  const { config, t, enqueue } = context;
  const channelId = config['discord-recruitment-channel-id'];

  const announce = async (registration: Registration) => {
    const channel = await fetchTextChannel(context, channelId);
    if (!channel) return;
    const recruiters = await RolesCollection.find({ canManageRecruits: true, discordRoleId: { $type: 'string', $ne: '' } }).fetchAsync();
    const roles = recruiters.map(role => role.discordRoleId!);
    const embed = new EmbedBuilder().setTitle(t('discord.bot.registrationNew')).addFields(
      { name: t('common.name'), value: text(registration.name), inline: true },
      { name: 'ID', value: text(registration.id), inline: true },
      { name: 'Discord', value: text(registration.discordTag), inline: true }
    );
    const message = await channel.send({ content: roles.map(id => `<@&${id}>`).join(' ') || undefined, embeds: [embed], allowedMentions: { roles } });
    // Stored before the thread is opened, so the post can still be closed if that fails.
    await RegistrationsCollection.updateAsync(registration._id!, { $set: { discordMessageId: message.id } });
    if (config['discord-recruitment-threads']) {
      await message.startThread({ name: `${String(registration.name)} (${String(registration.id)})`.slice(0, 100) });
    }
  };

  const close = async (registration: Registration) => {
    if (!registration.discordMessageId) return;
    const channel = await fetchTextChannel(context, channelId);
    const message = await channel?.messages.fetch(registration.discordMessageId).catch(() => null);
    if (!message) return;
    const accepted = await MembersCollection.findOneAsync({ 'profile.registrationId': registration._id }, { fields: { _id: 1 } });
    await message.edit({ content: t(accepted ? 'discord.bot.registrationAccepted' : 'discord.bot.registrationClosed'), allowedMentions: { parse: [] } });
    await message.thread?.setArchived(true);
  };

  return observeLive(RegistrationsCollection.find({}, { fields: { name: 1, id: 1, discordTag: 1, discordMessageId: 1 } }), {
    added: registration => {
      if (channelId) enqueue(() => announce(registration));
    },
    removed: registration => enqueue(() => close(registration)),
  });
}
