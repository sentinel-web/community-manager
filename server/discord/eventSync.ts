import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
} from 'discord.js';
import { Meteor } from 'meteor/meteor';
import EventsCollection from '../../imports/api/collections/events.collection';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import { htmlToMarkdown } from '../../imports/api/discord/htmlToMarkdown';
import { parsePreset } from '../../imports/api/events/preset';
import type { EventDoc } from '../../imports/api/types';
import { createLog } from '../apis/logs.server';
import { fetchTextChannel, observeLive, safe, type BotContext, type StopFn } from './bot';
import { findLinkedMember } from './memberSync';

export const RSVP_BUTTON_PREFIX = 'rsvp:';
const HOUR_MS = 60 * 60 * 1000;
// The fields that are mirrored to Discord. Writes to anything else (notably the
// server-owned discord* ids this module stores) must not trigger another sync.
const MIRRORED_FIELDS = ['name', 'start', 'end', 'eventType', 'isPrivate', 'description', 'hosts', 'attendees', 'preset'] as const;

const mirrored = (event: EventDoc): string => JSON.stringify(MIRRORED_FIELDS.map(field => event[field]));
const timestamp = (date: Date): string => `<t:${Math.floor(new Date(date).getTime() / 1000)}:F>`;

async function memberNames(ids: string[] = []): Promise<string> {
  if (!ids.length) return '-';
  const members = await MembersCollection.find({ _id: { $in: ids } }, { fields: { 'profile.name': 1 } }).fetchAsync();
  const names = members.map(member => member.profile!.name ?? '?').join(', ');
  return names.length > 1000 ? `${names.slice(0, 999)}…` : names;
}

async function buildAnnouncement({ t }: BotContext, event: EventDoc, typeName: string, scheduledEventUrl?: string) {
  const preset = parsePreset(event.preset);
  const embed = new EmbedBuilder()
    .setTitle(event.name.slice(0, 256))
    .setDescription(htmlToMarkdown(event.description, 2000) || null)
    .addFields(
      { name: t('events.eventType'), value: typeName, inline: true },
      { name: t('events.startDate'), value: timestamp(event.start), inline: true },
      { name: t('events.endDate'), value: timestamp(event.end), inline: true },
      { name: t('events.hosts'), value: await memberNames(event.hosts) },
      { name: `${t('events.attendees')} (${event.attendees?.length ?? 0})`, value: await memberNames(event.attendees) },
      ...(preset?.kind === 'link' ? [{ name: t('forms.labels.presetLink'), value: preset.url }] : []),
      ...(scheduledEventUrl ? [{ name: 'Discord', value: scheduledEventUrl }] : [])
    );
  if (/^#[0-9a-f]{6}$/i.test(event.color ?? '')) embed.setColor(parseInt(event.color!.slice(1), 16));
  const button = new ButtonBuilder()
    .setCustomId(`${RSVP_BUTTON_PREFIX}${event._id}`)
    .setLabel(t('discord.bot.rsvpButton'))
    .setStyle(ButtonStyle.Primary);
  return { embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)] };
}

async function removeFromDiscord(context: BotContext, event: EventDoc): Promise<void> {
  if (event.discordEventId) await context.guild.scheduledEvents.delete(event.discordEventId).catch(() => undefined);
  if (event.discordMessageId) {
    const channel = await fetchTextChannel(context, context.config['discord-events-channel-id']);
    await channel?.messages.delete(event.discordMessageId).catch(() => undefined);
  }
}

/** Brings the scheduled event and the announcement message in line with the stored event. */
async function syncEvent(context: BotContext, eventId: string): Promise<void> {
  const { guild, config } = context;
  const event = await EventsCollection.findOneAsync(eventId);
  if (!event) return;
  const type = event.eventType ? await EventTypesCollection.findOneAsync(event.eventType) : undefined;

  // Private events and event types that are not mirrored never reach Discord.
  if (!type?.createDiscordEvent || event.isPrivate) {
    if (!event.discordEventId && !event.discordMessageId) return;
    await removeFromDiscord(context, event);
    await EventsCollection.updateAsync(eventId, { $unset: { discordEventId: '', discordMessageId: '' } });
    return;
  }

  const stored: Partial<EventDoc> = {};
  const start = new Date(event.start);
  const end = new Date(event.end) > start ? new Date(event.end) : new Date(start.getTime() + HOUR_MS);
  const details = {
    name: event.name.slice(0, 100),
    description: htmlToMarkdown(event.description),
    scheduledStartTime: start,
    scheduledEndTime: end,
  };

  let scheduled = event.discordEventId ? await guild.scheduledEvents.fetch(event.discordEventId).catch(() => null) : null;
  if (scheduled?.status === GuildScheduledEventStatus.Scheduled) {
    const unchanged =
      scheduled.name === details.name &&
      (scheduled.description ?? '') === details.description &&
      scheduled.scheduledStartTimestamp === start.getTime() &&
      scheduled.scheduledEndTimestamp === end.getTime();
    if (!unchanged) await scheduled.edit(details);
  } else if (event.discordEventId === undefined && start > new Date()) {
    // `null` means it was deleted in Discord on purpose, so it is only created while never set.
    scheduled = await guild.scheduledEvents.create({
      ...details,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.External,
      entityMetadata: { location: Meteor.absoluteUrl().slice(0, 100) },
    });
    stored.discordEventId = scheduled.id;
  }

  const channel = await fetchTextChannel(context, config['discord-events-channel-id']);
  if (channel) {
    const announcement = await buildAnnouncement(context, event, type.name, scheduled?.url);
    if (event.discordMessageId) {
      // A message someone deleted in Discord stays deleted.
      const message = await channel.messages.fetch(event.discordMessageId).catch(() => null);
      await message?.edit(announcement);
    } else if (end > new Date()) {
      const preset = parsePreset(event.preset);
      const files = preset?.kind === 'file' ? [{ attachment: Buffer.from(preset.base64, 'base64'), name: preset.filename }] : [];
      stored.discordMessageId = (await channel.send({ ...announcement, files })).id;
    }
  }

  if (Object.keys(stored).length) await EventsCollection.updateAsync(eventId, { $set: stored });
}

/** Signs a member up for / off a public event. Returns the new state, or `null` when the event is not available. */
export async function setRsvp(eventId: string, userId: string, attending?: boolean): Promise<{ name: string; attending: boolean } | null> {
  const event = await EventsCollection.findOneAsync({ _id: eventId, isPrivate: { $ne: true } });
  if (!event) return null;
  const isSignedUp = (event.attendees ?? []).includes(userId);
  const next = attending ?? !isSignedUp;
  if (next !== isSignedUp) {
    await EventsCollection.updateAsync(eventId, (next ? { $addToSet: { attendees: userId } } : { $pull: { attendees: userId } }) as never);
    await createLog(next ? 'events.rsvp.added' : 'events.rsvp.removed', { eventId, userId, via: 'discord' });
  }
  return { name: event.name, attending: next };
}

export async function startEventSync(context: BotContext): Promise<StopFn> {
  const { client, guild, enqueue } = context;

  // Web → Discord. Only events that have not ended yet are tracked.
  const stop = await observeLive(EventsCollection.find({ end: { $gte: new Date() } }), {
    added: event => enqueue(() => syncEvent(context, event._id!)),
    changed: (event, previous) => {
      if (mirrored(event) !== mirrored(previous)) enqueue(() => syncEvent(context, event._id!));
    },
    removed: event => enqueue(() => removeFromDiscord(context, event)),
  });

  // Discord → web: "Interested" on the scheduled event is the event sign-up.
  const interested = (attending: boolean) =>
    safe(async (scheduled: { id: string; guildId: string }, discordUser: { id: string }) => {
      if (scheduled.guildId !== guild.id) return;
      const [event, member] = await Promise.all([
        EventsCollection.findOneAsync({ discordEventId: scheduled.id }, { fields: { _id: 1 } }),
        findLinkedMember(discordUser.id),
      ]);
      if (event && member) await setRsvp(event._id!, member._id, attending);
    });
  client.on(Events.GuildScheduledEventUserAdd, interested(true));
  client.on(Events.GuildScheduledEventUserRemove, interested(false));

  // Discord → web: renaming or rescheduling the scheduled event updates the event.
  // The description is not taken back — Discord only holds a plain-text rendering of it.
  client.on(
    Events.GuildScheduledEventUpdate,
    safe(async (previous, scheduled) => {
      if (scheduled.guildId !== guild.id || !previous) return;
      const event = await EventsCollection.findOneAsync({ discordEventId: scheduled.id });
      if (!event) return;
      const changes: Partial<EventDoc> = {};
      if (previous.name !== scheduled.name && scheduled.name !== event.name.slice(0, 100)) changes.name = scheduled.name;
      if (scheduled.scheduledStartAt && scheduled.scheduledStartTimestamp !== new Date(event.start).getTime()) changes.start = scheduled.scheduledStartAt;
      if (scheduled.scheduledEndAt && scheduled.scheduledEndTimestamp !== new Date(event.end).getTime()) changes.end = scheduled.scheduledEndAt;
      if (!Object.keys(changes).length) return;
      await EventsCollection.updateAsync(event._id!, { $set: changes });
      await createLog('discord.eventUpdated', { id: event._id, changes });
    })
  );

  // Discord → web: a deleted scheduled event is detached (not recreated); the event itself stays.
  client.on(
    Events.GuildScheduledEventDelete,
    safe(async scheduled => {
      await EventsCollection.updateAsync({ discordEventId: scheduled.id }, { $set: { discordEventId: null } });
    })
  );

  return stop;
}
