import { Meteor } from 'meteor/meteor';
import { Client, GatewayIntentBits } from 'discord.js';
import { handleInteractions } from './interactions.js';

let discordClient;
let readyPromise;

export function getDiscord() {
  if (discordClient) {
    return { client: discordClient, ready: readyPromise };
  }

  const token = Meteor.settings?.discord?.botToken;
  if (!token) {
    throw new Meteor.Error(
      'discord-config-missing',
      'botToken fehlt in settings.json (Meteor.settings.discord.botToken)'
    );
  }

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ],
  });

  readyPromise = new Promise((resolve, reject) => {
    discordClient.once('ready', () => {
      console.log(`[Discord] Bot online als ${discordClient.user.tag}`);
      resolve();
    });
    discordClient.once('error', reject);
  });

  discordClient.login(token).catch((err) => {
    console.error('[Discord] Login fehlgeschlagen:', err);
  });

  discordClient.on('interactionCreate', (interaction) => {
  console.log('[Discord] interactionCreate:', {
    type: interaction.type,
    isChatInputCommand: interaction.isChatInputCommand?.(),
    name: interaction.commandName,
    user: interaction.user?.username,
    guild: interaction.guildId,
  });

  handleInteractions(discordClient, interaction).catch((err) => {
    console.error('[Discord] interaction error:', err);
  });
});


  return { client: discordClient, ready: readyPromise };
}
