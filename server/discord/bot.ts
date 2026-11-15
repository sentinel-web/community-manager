import { Client, Events, GatewayIntentBits, type Guild, type GuildTextBasedChannel } from 'discord.js';
import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import {
  DISCORD_CONFIG_DEFAULTS,
  DISCORD_CONFIG_KEYS,
  DISCORD_STATUS_KEY,
  DISCORD_TOKEN_KEY,
  type DiscordConfig,
  type DiscordStatus,
} from '../../imports/api/discord/settings';
import { getTranslation, type Translator } from '../../imports/i18n';
import { decrypt } from '../encryption';
import { startCommands } from './commands';
import { startEventSync } from './eventSync';
import { startMemberSync } from './memberSync';
import { startRegistrationSync } from './registrationSync';
import { startSpamProtection } from './spamProtection';
import { startTaskSync } from './taskSync';

/** Everything a feature module needs. One context per successful login; discarded on reload. */
export interface BotContext {
  client: Client<true>;
  guild: Guild;
  config: DiscordConfig;
  /** Translates into the configured bot language. */
  t: Translator;
  /** Runs Discord work strictly in order, so two changes to the same document cannot race. */
  enqueue: (task: () => Promise<unknown>) => void;
}

/** A feature module registers its listeners/observers and returns how to remove them. */
export type StopFn = () => void;

const CONNECT_TIMEOUT_MS = 30_000;

let active: { context: BotContext; stops: StopFn[] } | null = null;
// Bumped on every (re)start, so a start that was overtaken by a newer one discards its client.
let generation = 0;
let status: DiscordStatus = { state: 'disabled', tokenSet: false };

async function setStatus(next: DiscordStatus): Promise<void> {
  status = next;
  await SettingsCollection.upsertAsync({ key: DISCORD_STATUS_KEY }, { $set: { key: DISCORD_STATUS_KEY, value: next } });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Surfaces a runtime failure (missing permission, role hierarchy, …) on the settings page without stopping the bot. */
export function reportDiscordError(error: unknown): void {
  console.error('[discord]', error);
  setStatus({ ...status, error: errorMessage(error) }).catch(console.error);
}

/** Wraps a gateway listener so a failure is reported instead of becoming an unhandled rejection. */
export function safe<Args extends unknown[]>(listener: (...args: Args) => Promise<unknown> | unknown): (...args: Args) => void {
  return (...args) => {
    Promise.resolve()
      .then(() => listener(...args))
      .catch(reportDiscordError);
  };
}

/**
 * Observes a cursor for changes made from now on: the documents that already exist (which
 * Meteor reports as `added` before the returned promise resolves) are skipped.
 */
export async function observeLive<T>(cursor: Mongo.Cursor<T>, callbacks: Mongo.ObserveCallbacks<T>): Promise<StopFn> {
  let live = false;
  const added = (doc: T) => {
    if (live) callbacks.added?.(doc);
  };
  // Meteor 3 returns a promise here on the server; the published typings still describe the sync handle.
  const handle = await (cursor.observe({ ...callbacks, added }) as Meteor.LiveQueryHandle | Promise<Meteor.LiveQueryHandle>);
  live = true;
  return () => handle.stop();
}

export async function loadDiscordConfig(): Promise<DiscordConfig> {
  const docs = await SettingsCollection.find({ key: { $in: DISCORD_CONFIG_KEYS } }).fetchAsync();
  const stored = Object.fromEntries(docs.map(doc => [doc.key, doc.value]));
  return { ...DISCORD_CONFIG_DEFAULTS, ...stored } as DiscordConfig;
}

/** The live context, or `null` while the bot is disabled, connecting or failed. */
export function getDiscordContext(): BotContext | null {
  return active?.context ?? null;
}

export async function fetchTextChannel(context: BotContext, channelId: string): Promise<GuildTextBasedChannel | null> {
  if (!channelId) return null;
  const channel = await context.guild.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

export async function stopDiscordBot(): Promise<void> {
  const current = active;
  active = null;
  if (!current) return;
  current.stops.forEach(stop => stop());
  await current.context.client.destroy();
}

/** (Re)starts the bot from the stored settings. Never throws: the outcome is written to the status setting. */
export async function startDiscordBot(): Promise<void> {
  const mine = ++generation;
  await stopDiscordBot();

  const config = await loadDiscordConfig();
  const tokenDoc = await SettingsCollection.findOneAsync({ key: DISCORD_TOKEN_KEY });
  const encryptedToken = typeof tokenDoc?.value === 'string' ? tokenDoc.value : '';
  const tokenSet = encryptedToken !== '';
  if (!config['discord-enabled'] || !tokenSet || !config['discord-server-id']) {
    await setStatus({ state: 'disabled', tokenSet });
    return;
  }

  // The test suite must never open a gateway connection, whatever settings a test stores.
  if (Meteor.isTest || Meteor.isAppTest) return;

  await setStatus({ state: 'connecting', tokenSet });
  const spamProtection = config['discord-spam-protection-enabled'];
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildScheduledEvents,
      // Message content is a privileged intent; only request it for the one feature that reads messages.
      ...(spamProtection ? [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] : []),
    ],
    // Nothing the bot posts may ping anyone unless a call site opts in explicitly.
    allowedMentions: { parse: [] },
  });
  client.on(Events.Error, reportDiscordError);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The whole connect sequence is bounded, so an unreachable gateway ends as a visible error
    // instead of a start that never settles.
    const connect = (async () => {
      const ready = new Promise<Client<true>>(resolve => client.once(Events.ClientReady, resolve));
      await client.login(decrypt(encryptedToken));
      const readyClient = await ready;
      const guild = await readyClient.guilds.fetch(config['discord-server-id']);
      // Caches every member, so role changes can be compared against the previous state.
      await guild.members.fetch();
      return { readyClient, guild };
    })();
    // If the timeout wins, a later failure of the abandoned attempt must not go unhandled.
    connect.catch(() => undefined);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out connecting to Discord')), CONNECT_TIMEOUT_MS);
    });
    const { readyClient, guild } = await Promise.race([connect, timeout]);

    let queue: Promise<unknown> = Promise.resolve();
    const context: BotContext = {
      client: readyClient,
      guild,
      config,
      t: (key, ...args) => getTranslation(key, config['discord-language'], ...args),
      enqueue: task => {
        queue = queue.then(task).catch(reportDiscordError);
      },
    };
    const started = await Promise.allSettled([
      startCommands(context),
      startEventSync(context),
      startMemberSync(context),
      startRegistrationSync(context),
      startTaskSync(context),
      ...(spamProtection ? [startSpamProtection(context)] : []),
    ]);
    const stops = started.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
    const failure = started.find(result => result.status === 'rejected');
    // A partial start, or a start overtaken by a newer one, must not leave observers behind.
    if (failure || mine !== generation) {
      stops.forEach(stop => stop());
      await client.destroy();
      if (failure) throw failure.reason;
      return;
    }
    active = { context, stops };
    await setStatus({ state: 'connected', tokenSet, botTag: readyClient.user.tag, guildName: guild.name });
  } catch (error) {
    console.error('[discord] start failed:', error);
    await client.destroy().catch(() => undefined);
    if (mine === generation) await setStatus({ state: 'error', tokenSet, error: errorMessage(error) });
  } finally {
    clearTimeout(timer);
  }
}
