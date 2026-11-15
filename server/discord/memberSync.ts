import crypto from 'crypto';
import { Events, type GuildMember, type PartialGuildMember } from 'discord.js';
import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import RolesCollection from '../../imports/api/collections/roles.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { diffDiscordRoles, profileChangesFromDiscord, type RoleLink, type RoleLinkKind, type SyncedProfile } from '../../imports/api/discord/roleSync';
import { createLog } from '../apis/logs.server';
import { observeLive, safe, type BotContext, type StopFn } from './bot';

const LINK_CODE_TTL_MS = 10 * 60 * 1000;
const LINK_ATTEMPTS = 5;
const SYNCED_FIELDS = {
  'profile.discordId': 1,
  'profile.rankId': 1,
  'profile.roleId': 1,
  'profile.squadId': 1,
  'profile.specializationIds': 1,
} as const;

interface LinkedMember {
  _id: string;
  profile?: SyncedProfile & { discordId?: string };
}

const hashCode = (code: string): string => crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

/** Every rank / role / squad / specialization that is mapped to a Discord role. */
export async function loadRoleLinks(): Promise<RoleLink[]> {
  const mapped = { discordRoleId: { $type: 'string' as const, $ne: '' } };
  const options = { fields: { discordRoleId: 1 } };
  const sources: [RoleLinkKind, Mongo.Collection<{ _id?: string; discordRoleId?: string }>][] = [
    ['rank', RanksCollection as never],
    ['role', RolesCollection as never],
    ['squad', SquadsCollection as never],
    ['specialization', SpecializationsCollection as never],
  ];
  const lists = await Promise.all(
    sources.map(async ([kind, collection]) =>
      (await collection.find(mapped, options).fetchAsync()).map(doc => ({ kind, id: doc._id!, discordRoleId: doc.discordRoleId! }))
    )
  );
  return lists.flat();
}

export function findLinkedMember(discordId: string): Promise<Meteor.User | undefined> {
  return MembersCollection.findOneAsync({ 'profile.discordId': discordId }) as Promise<Meteor.User | undefined>;
}

/** Makes the Discord member's managed roles match the profile (`null` profile = strip every managed role). */
export async function reconcileMember(context: BotContext, profile: SyncedProfile | null, discordId: string, links?: RoleLink[]): Promise<void> {
  const member = await context.guild.members.fetch(discordId).catch(() => null);
  if (!member) return;
  const { add, remove } = diffDiscordRoles(profile, [...member.roles.cache.keys()], links ?? (await loadRoleLinks()));
  const assignable = add.filter(id => context.guild.roles.cache.has(id));
  if (assignable.length) await member.roles.add(assignable);
  if (remove.length) await member.roles.remove(remove);
}

/** Pushes the web state of every linked member to Discord. Returns how many members were processed. */
export async function syncAllMembers(context: BotContext): Promise<number> {
  const links = await loadRoleLinks();
  const members = (await MembersCollection.find({ 'profile.discordId': { $exists: true } }, { fields: SYNCED_FIELDS }).fetchAsync()) as LinkedMember[];
  for (const member of members) {
    await reconcileMember(context, member.profile ?? {}, member.profile!.discordId!, links);
  }
  return members.length;
}

/**
 * One-time bootstrap for communities that already recorded Discord usernames: links every
 * unlinked member whose `profile.discordTag` matches exactly one guild member's username.
 * Admin-triggered only — a username is a claim, not proof, which is why this is never automatic.
 */
export async function linkMembersByTag(context: BotContext): Promise<number> {
  const guildMembers = await context.guild.members.fetch();
  const idByUsername = new Map(guildMembers.map(member => [member.user.username.toLowerCase(), member.id]));
  const candidates = await MembersCollection.find(
    { 'profile.discordTag': { $type: 'string', $ne: '' }, 'profile.discordId': { $exists: false } },
    { fields: { 'profile.discordTag': 1 } }
  ).fetchAsync();
  let linked = 0;
  for (const member of candidates) {
    const discordId = idByUsername.get(member.profile!.discordTag!.trim().replace(/^@/, '').toLowerCase());
    if (!discordId || (await findLinkedMember(discordId))) continue;
    await MembersCollection.updateAsync(member._id, { $set: { 'profile.discordId': discordId } });
    linked++;
  }
  return linked;
}

/** Issues a one-time code the member redeems with `/link` in Discord, proving control of both accounts. */
export async function createLinkCode(userId: string): Promise<string> {
  const code = crypto.randomBytes(5).toString('hex').toUpperCase();
  await MembersCollection.updateAsync(userId, {
    $set: { 'services.discordLink': { hash: hashCode(code), expiresAt: new Date(Date.now() + LINK_CODE_TTL_MS) } },
  });
  return code;
}

const failedAttempts = new Map<string, number[]>();

export async function redeemLinkCode(code: string, discordUser: { id: string; username: string }): Promise<'linked' | 'invalid' | 'taken' | 'throttled'> {
  const recent = (failedAttempts.get(discordUser.id) ?? []).filter(at => Date.now() - at < LINK_CODE_TTL_MS);
  if (recent.length >= LINK_ATTEMPTS) return 'throttled';
  if (await findLinkedMember(discordUser.id)) return 'taken';
  const updated = await MembersCollection.updateAsync(
    { 'services.discordLink.hash': hashCode(code), 'services.discordLink.expiresAt': { $gt: new Date() } },
    { $set: { 'profile.discordId': discordUser.id, 'profile.discordTag': discordUser.username }, $unset: { 'services.discordLink': '' } }
  );
  if (!updated) {
    failedAttempts.set(discordUser.id, [...recent, Date.now()]);
    return 'invalid';
  }
  await createLog('discord.linked', { discordId: discordUser.id });
  return 'linked';
}

export async function startMemberSync(context: BotContext): Promise<StopFn> {
  const { client, guild, config, enqueue } = context;

  // Web → Discord. Entering the cursor = linked, leaving it = unlinked or deleted.
  const sync = (member: LinkedMember, profile: SyncedProfile | null) => enqueue(() => reconcileMember(context, profile, member.profile!.discordId!));
  const stop = await observeLive<LinkedMember>(MembersCollection.find({ 'profile.discordId': { $exists: true } }, { fields: SYNCED_FIELDS }) as never, {
    added: member => sync(member, member.profile ?? {}),
    changed: member => sync(member, member.profile ?? {}),
    removed: member => sync(member, null),
  });

  // Discord → web (ranks, squads, specializations — never permission roles), then web → Discord
  // again so anything the profile does not back (e.g. a removed rank role) is restored.
  client.on(
    Events.GuildMemberUpdate,
    safe(async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
      if (newMember.guild.id !== guild.id) return;
      const before = [...oldMember.roles.cache.keys()];
      const after = [...newMember.roles.cache.keys()];
      if (!oldMember.partial && before.length === after.length && before.every(id => after.includes(id))) return;
      enqueue(async () => {
        const user = await findLinkedMember(newMember.id);
        if (!user) return;
        const links = await loadRoleLinks();
        if (config['discord-inbound-role-sync'] && !oldMember.partial) {
          const changes = profileChangesFromDiscord(user.profile ?? {}, before, after, links);
          if (Object.keys(changes).length) {
            // The observer above picks this write up and reconciles the Discord side.
            await MembersCollection.updateAsync(user._id, { $set: changes });
            await createLog('discord.memberSynced', { id: user._id, changes });
            return;
          }
        }
        await reconcileMember(context, user.profile ?? {}, newMember.id, links);
      });
    })
  );
  client.on(
    Events.GuildMemberAdd,
    safe(async (member: GuildMember) => {
      if (member.guild.id !== guild.id) return;
      const user = await findLinkedMember(member.id);
      if (user) enqueue(() => reconcileMember(context, user.profile ?? {}, member.id));
    })
  );

  // Gateway listeners die with the client (see stopDiscordBot); only the observer needs stopping.
  return stop;
}
