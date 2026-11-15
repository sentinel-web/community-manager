import { Events, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction, type Interaction } from 'discord.js';
import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import { createLog } from '../apis/logs.server';
import { loadMemberPoints } from '../attendance-points';
import { safe, type BotContext, type StopFn } from './bot';
import { RSVP_BUTTON_PREFIX, setRsvp } from './eventSync';
import { findLinkedMember, redeemLinkCode } from './memberSync';

const LIST_LIMIT = 10;
const unix = (date: Date): number => Math.floor(new Date(date).getTime() / 1000);

type Handler = (interaction: ChatInputCommandInteraction, member: Meteor.User) => Promise<string>;

/** Slash commands and the sign-up button. Every reply is ephemeral — only the caller sees it. */
export async function startCommands(context: BotContext): Promise<StopFn> {
  const { client, guild, t } = context;

  // Commands that act for a linked member; the member is resolved before the handler runs.
  const memberCommands: Record<string, Handler> = {
    events: async (_, member) => {
      const events = await EventsCollection.find(
        { end: { $gte: new Date() }, $or: [{ isPrivate: { $ne: true } }, { hosts: member._id }, { attendees: member._id }] },
        { sort: { start: 1 }, limit: LIST_LIMIT, fields: { name: 1, start: 1, attendees: 1 } }
      ).fetchAsync();
      return events.map(event => `${event.attendees?.includes(member._id) ? '✅' : '▫️'} <t:${unix(event.start)}:f> **${event.name}**`).join('\n') || t('discord.bot.noEvents');
    },
    tasks: async (_, member) => {
      const tasks = await TasksCollection.find(
        { participants: member._id, completedBy: { $ne: member._id } },
        { sort: { createdAt: -1 }, limit: LIST_LIMIT, fields: { name: 1, priority: 1 } }
      ).fetchAsync();
      return tasks.map(task => `- **${task.name}**${task.priority ? ` (${t('tasks.priority')}: ${task.priority})` : ''}`).join('\n') || t('discord.bot.noTasks');
    },
    profile: async (_, member) => {
      const profile = member.profile ?? {};
      const [rank, squad, points] = await Promise.all([
        profile.rankId ? RanksCollection.findOneAsync(profile.rankId) : undefined,
        profile.squadId ? SquadsCollection.findOneAsync(profile.squadId) : undefined,
        loadMemberPoints([member]),
      ]);
      return [
        `**${profile.name ?? member.username}**`,
        `${t('members.rank')}: ${rank?.name ?? '-'}`,
        `${t('members.squad')}: ${squad?.name ?? '-'}`,
        `${t('events.attendancePoints')}: ${points[member._id]?.attendancePoints ?? 0}`,
        `${t('events.inactivityPoints')}: ${points[member._id]?.inactivityPoints ?? 0}`,
      ].join('\n');
    },
    unlink: async (_, member) => {
      await MembersCollection.updateAsync(member._id, { $unset: { 'profile.discordId': '' } });
      await createLog('discord.unlinked', { id: member._id, via: 'discord' });
      return t('discord.bot.unlinked');
    },
  };

  await guild.commands.set([
    new SlashCommandBuilder()
      .setName('link')
      .setDescription(t('discord.bot.cmdLink'))
      .addStringOption(option => option.setName('code').setDescription(t('discord.bot.cmdLinkCode')).setRequired(true)),
    ...Object.entries({
      unlink: t('discord.bot.cmdUnlink'),
      events: t('discord.bot.cmdEvents'),
      tasks: t('discord.bot.cmdTasks'),
      profile: t('discord.bot.cmdProfile'),
    }).map(([name, description]) => new SlashCommandBuilder().setName(name).setDescription(description)),
  ]);

  const respond = async (interaction: Interaction): Promise<string | null> => {
    if (interaction.guildId !== guild.id) return null;
    if (interaction.isChatInputCommand() && interaction.commandName === 'link') {
      const result = await redeemLinkCode(interaction.options.getString('code', true), interaction.user);
      return t(`discord.bot.link.${result}`);
    }
    const isRsvp = interaction.isButton() && interaction.customId.startsWith(RSVP_BUTTON_PREFIX);
    const handler = interaction.isChatInputCommand() ? memberCommands[interaction.commandName] : undefined;
    if (!isRsvp && !handler) return null;

    const member = await findLinkedMember(interaction.user.id);
    if (!member) return t('discord.bot.notLinked');
    if (handler) return handler(interaction as ChatInputCommandInteraction, member);

    const rsvp = await setRsvp((interaction as { customId: string }).customId.slice(RSVP_BUTTON_PREFIX.length), member._id);
    if (!rsvp) return t('discord.bot.eventNotFound');
    return t(rsvp.attending ? 'discord.bot.rsvpAdded' : 'discord.bot.rsvpRemoved', { name: rsvp.name });
  };

  client.on(
    Events.InteractionCreate,
    safe(async (interaction: Interaction) => {
      if (!interaction.isRepliable()) return;
      // Acknowledge first: Discord drops an interaction that is not answered within three seconds.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const content = await respond(interaction).catch(error => {
        console.error('[discord] interaction failed:', error);
        return t('discord.bot.failed');
      });
      await interaction.editReply({ content: content ?? t('discord.bot.failed') });
    })
  );

  return () => undefined;
}
