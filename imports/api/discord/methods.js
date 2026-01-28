import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { getDiscord } from '../../server/discord/client.js';

Meteor.methods({
  async 'discord.resolveUserIdByGlobalUsername'({ username, guildId }) {
    check(username, String);
    check(guildId, Match.Maybe(String));

    const targetGuildId =
      guildId || Meteor.settings?.discord?.defaultGuildId;

    if (!targetGuildId) {
      throw new Meteor.Error(
        'discord-config-missing',
        'Keine Guild-ID gefunden (settings.json → discord.defaultGuildId)'
      );
    }

    const { client, ready } = getDiscord();
    await ready;

    // Debug-Hilfe
    console.log(
      '[Discord] Sichtbare Guilds:',
      client.guilds.cache.map(g => `${g.name} (${g.id})`)
    );

    if (!client.guilds.cache.has(targetGuildId)) {
      throw new Meteor.Error(
        'discord-unknown-guild',
        `Bot ist nicht in der Guild ${targetGuildId}`
      );
    }

    const guild = await client.guilds.fetch(targetGuildId);
    const results = await guild.members.search({
      query: username.trim(),
      limit: 20
    });

    const candidates = results.map(m => ({
      id: m.user.id,
      username: m.user.username,
      displayName: m.displayName
    }));

    const exact = candidates.find(
      c => c.username.toLowerCase() === username.toLowerCase()
    );

    if (!exact) {
      return { found: false, candidates };
    }

    return { found: true, user: exact, candidates };
  }
});

DDPRateLimiter.addRule(
  { name: 'discord.resolveUserIdByGlobalUsername', type: 'method' },
  5,
  1000
);
