import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import type { Mongo } from 'meteor/mongo';
import EventsCollection from '../../imports/api/collections/events.collection';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { DISCORD_TOKEN_KEY } from '../../imports/api/discord/settings';
import type { SettingDoc } from '../../imports/api/types';
import { createLinkCode, redeemLinkCode } from '../../server/discord/memberSync';
import { decrypt, encrypt } from '../../server/encryption';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

type PublishHandler = (this: { userId: string | null }, ...args: unknown[]) => unknown;

async function subscribeToSettings(userId: string, filter: Record<string, unknown>): Promise<SettingDoc[]> {
  const handlers = (Meteor as unknown as { server: { publish_handlers: Record<string, PublishHandler> } }).server.publish_handlers;
  const cursor = (await handlers.settings.apply({ userId }, [filter])) as Mongo.Cursor<SettingDoc>;
  return cursor.fetchAsync();
}

describe('encryption', () => {
  it('round-trips and never stores the plaintext', () => {
    const stored = encrypt('super-secret-token');
    assert.ok(!stored.includes('super-secret-token'));
    assert.strictEqual(decrypt(stored), 'super-secret-token');
  });

  it('rejects tampered and foreign values instead of returning garbage', () => {
    const [version, iv, tag, data] = encrypt('super-secret-token').split(':');
    const flipped = data.slice(0, -1) + (data.endsWith('0') ? '1' : '0');
    assert.throws(() => decrypt([version, iv, tag, flipped].join(':')), (error: unknown) => (error as Meteor.Error).error === 'decryption-failed');
    assert.throws(() => decrypt('plain-text'), (error: unknown) => (error as Meteor.Error).error === 'decryption-failed');
  });
});

describe('Discord settings — the bot token never reaches a client', () => {
  let adminUserId: string;
  let memberUserId: string;

  before(async () => {
    const [adminRoleId, memberRoleId] = await Promise.all([createTestRole({ settings: true }), createTestRole({})]);
    [adminUserId, memberUserId] = await Promise.all([createTestUser({ roleId: adminRoleId }), createTestUser({ roleId: memberRoleId })]);
  });

  after(async () => {
    await SettingsCollection.removeAsync({ key: { $regex: '^discord-' } });
    await cleanupFixtures();
  });

  it('discord.configure requires the settings permission', async () => {
    await assertRejectsWithCode(() => callAs(memberUserId, 'discord.configure', { 'discord-enabled': false }), 403);
    await assertRejectsWithCode(() => callAs(null, 'discord.configure', { 'discord-enabled': false }), 401);
  });

  it('discord.configure rejects unknown keys and malformed ids', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'discord.configure', { 'discord-bot-token': 'x' }), 400);
    await assertRejectsWithCode(() => callAs(adminUserId, 'discord.configure', { 'discord-server-id': 'not-an-id' }), 400);
    await assertRejectsWithCode(() => callAs(adminUserId, 'discord.configure', { 'discord-enabled': 'yes' }), 400);
  });

  it('stores the token encrypted and keeps it out of the publication and settings.findOne', async () => {
    await callAs(adminUserId, 'discord.configure', { 'discord-enabled': false, 'discord-server-id': '123456789012345678' }, 'bot-token-value');

    const stored = await SettingsCollection.findOneAsync({ key: DISCORD_TOKEN_KEY });
    assert.notStrictEqual(stored?.value, 'bot-token-value');
    assert.strictEqual(decrypt(stored?.value as string), 'bot-token-value');

    const all = await subscribeToSettings(adminUserId, {});
    assert.ok(all.some(doc => doc.key === 'discord-server-id'));
    assert.ok(!all.some(doc => doc.key === DISCORD_TOKEN_KEY));
    assert.deepStrictEqual(await subscribeToSettings(adminUserId, { key: DISCORD_TOKEN_KEY }), []);
    await assertRejectsWithCode(() => callAs(adminUserId, 'settings.findOne', DISCORD_TOKEN_KEY), 403);
  });

  it('an empty token keeps the stored one', async () => {
    await callAs(adminUserId, 'discord.configure', { 'discord-enabled': false }, '');
    const stored = await SettingsCollection.findOneAsync({ key: DISCORD_TOKEN_KEY });
    assert.strictEqual(decrypt(stored?.value as string), 'bot-token-value');
  });

  it('settings.upsert cannot bypass discord.configure', async () => {
    await assertRejectsWithCode(() => callAs(adminUserId, 'settings.upsert', 'discord-enabled', true), 400);
    await assertRejectsWithCode(() => callAs(adminUserId, 'settings.upsert', DISCORD_TOKEN_KEY, 'plain'), 400);
  });
});

describe('Discord link — server-owned ids', () => {
  let adminUserId: string;
  let memberUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    [adminUserId, memberUserId] = await Promise.all([createTestUser({ roleId: adminRoleId }), createTestUser({ roleId: adminRoleId })]);
  });

  after(async () => {
    await cleanupFixtures([EventsCollection]);
  });

  it('links a member only with a valid one-time code', async () => {
    const discordUser = { id: '111111111111111111', username: 'tester' };
    assert.strictEqual(await redeemLinkCode('WRONGCODE0', discordUser), 'invalid');

    const code = await createLinkCode(memberUserId);
    assert.strictEqual(await redeemLinkCode(code.toLowerCase(), discordUser), 'linked');
    const member = await Meteor.users.findOneAsync(memberUserId);
    assert.strictEqual(member!.profile!.discordId, discordUser.id);
    assert.strictEqual(member!.profile!.discordTag, 'tester');

    // The code is single-use, and a Discord account links to one member only.
    assert.strictEqual(await redeemLinkCode(code, { id: '222222222222222222', username: 'other' }), 'invalid');
    assert.strictEqual(await redeemLinkCode(await createLinkCode(adminUserId), discordUser), 'taken');
  });

  it('members.update can neither set nor drop the link, even when it replaces the whole profile', async () => {
    const before = await Meteor.users.findOneAsync(memberUserId);
    await callAs(adminUserId, 'members.update', memberUserId, { profile: { ...before?.profile, discordId: '999999999999999999', description: 'edited' } });
    await callAs(adminUserId, 'members.update', adminUserId, { 'profile.discordId': '999999999999999999', 'profile.description': 'edited' });

    const [member, admin] = await Promise.all([Meteor.users.findOneAsync(memberUserId), Meteor.users.findOneAsync(adminUserId)]);
    assert.strictEqual(member!.profile!.discordId, '111111111111111111');
    assert.strictEqual(member!.profile!.description, 'edited');
    assert.strictEqual(admin?.profile?.discordId, undefined);
  });

  it('discord.unlink removes the own link; unlinking others needs members.update', async () => {
    const plainUserId = await createTestUser({ roleId: await createTestRole({}) });
    await assertRejectsWithCode(() => callAs(plainUserId, 'discord.unlink', memberUserId), 403);
    await callAs(memberUserId, 'discord.unlink');
    assert.strictEqual((await Meteor.users.findOneAsync(memberUserId))?.profile?.discordId, undefined);
  });

  it('events.update rejects the server-owned Discord ids', async () => {
    const eventId = await createTestDoc(EventsCollection, { name: 'Op', start: new Date(), end: new Date() });
    await assertRejectsWithCode(() => callAs(adminUserId, 'events.update', eventId, { discordEventId: '1' }), 'server-owned-field');
    await assertRejectsWithCode(() => callAs(adminUserId, 'events.update', eventId, { discordMessageId: '1' }), 'server-owned-field');
  });
});
