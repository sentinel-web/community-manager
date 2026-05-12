import { Client, GatewayIntentBits } from 'discord.js';
import { Meteor } from 'meteor/meteor';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { decrypt } from '../encryption';

// Singleton-Instanz des Bots
let client: Client | null = null;

export const initializeDiscordBot = async () => {
  const tokenSetting = await SettingsCollection.findOneAsync({ key: 'discord-bot-token' });
  const enabledSetting = await SettingsCollection.findOneAsync({ key: 'discord-enabled' });

  // Nur starten, wenn aktiviert und Token vorhanden
  if (enabledSetting?.value === true && tokenSetting?.value) {
    try {
      const decryptedToken = decrypt(tokenSetting.value as string);      
      
      client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

      client.once('clientReady', (c) => {
        console.log(`[Discord] Eingeloggt als ${c.user.tag}`);
      });

      await client.login(decryptedToken);
    } catch (error) {
      console.error('[Discord] Fehler beim Bot-Start:', error);
    }
  }
};

// Funktion zum Neustarten des Bots (wichtig bei Einstellungsänderungen)
export const reloadDiscordBot = async () => {
  if (client) {
    await client.destroy();
    client = null;
  }
  await initializeDiscordBot();
};