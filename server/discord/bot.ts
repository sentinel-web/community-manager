import { Client, GatewayIntentBits } from 'discord.js';
import { Meteor } from 'meteor/meteor';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { decrypt } from '../encryption';
import RegistrationsCollection from '/imports/api/collections/registrations.collection';
import RolesCollection from '/imports/api/collections/roles.collection';

let client: Client | null = null;
let registrationObserverHandle: any = null;

export const initializeDiscordBot = async () => {
  const tokenSetting = await SettingsCollection.findOneAsync({ key: 'discord-bot-token' });
  const enabledSetting = await SettingsCollection.findOneAsync({ key: 'discord-enabled' });

  // Falls deaktiviert oder kein Token da, Zustand bereinigen und abbrechen
  if (enabledSetting?.value !== true || !tokenSetting?.value) {
    if (client) {
      await client.destroy();
      client = null;
    }
    return;
  }

  try {
    const decryptedToken = decrypt(tokenSetting.value as string);      
    
    if (client) {
      await client.destroy();
      client = null;
    }

    client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

    // Login in einem Promise kapseln, um Fehler sauber abzufangen ohne Node zu crashen
    await new Promise<void>((resolve, reject) => {
      client!.once('clientReady', (c) => {
        console.log(`[Discord] Eingeloggt als ${c.user.tag}`);
        // Erfolgsfall: Fehlermeldung in der DB löschen
        SettingsCollection.upsertAsync({ key: 'discord-error-message' }, { $set: { key: 'discord-error-message', value: null } }).catch(console.error);
        let initializing = true;
        registrationObserverHandle = RegistrationsCollection.find().observe({
          added: (doc: any) => {
            if (initializing) return; // Verhindert Spam bereits existierender Bewerbungen beim Booten

            // Asynchron ausführen, um den Hauptthread nicht zu blockieren
            Meteor.defer(async () => {
              try {
                const channelSetting = await SettingsCollection.findOneAsync({ key: 'discord-recruitment-channel-id' });
                const serverSetting = await SettingsCollection.findOneAsync({ key: 'discord-server-id' });
                
                const channelId = channelSetting?.value as string | undefined;
                const serverId = serverSetting?.value as string | undefined;

                if (!channelId || !serverId) return;

                const guild = client?.guilds.cache.get(serverId) || await client?.guilds.fetch(serverId).catch(() => null);
                const channel = guild?.channels.cache.get(channelId) || await guild?.channels.fetch(channelId).catch(() => null);

                if (channel && 'send' in channel) {
                  // Alle Rollen suchen, die Rekruten verwalten dürfen
                  const recruiterRoles = await RolesCollection.find({ canManageRecruits: true }).fetchAsync();
                  
                  // Erstellt Mentions-Format für Discord: <@&RollenID>
                  const roleMentions = recruiterRoles
                    .map((r: any) => r.discordRoleId)
                    .filter(Boolean)
                    .map((id: string) => `<@&${id}>`)
                    .join(' ');

                  const mentionPrefix = roleMentions ? `${roleMentions} ` : '';

                  await (channel as any).send({
                    content: `${mentionPrefix}Eine neue Bewerbung von **${doc.name}** (Gewünschte ID: ${doc.id}) ist eingegangen!`,
                  });
                }
              } catch (err) {
                console.error('[Discord] Fehler beim Senden der Bewerbungs-Benachrichtigung:', err);
              }
            });
          }
        });
        initializing = false; 
        resolve();
      });

      client!.login(decryptedToken).catch((err) => {
        reject(err);
      });
    });

  } catch (error) {
    const errMsg = (error as Error).message;
    console.error('[Discord] Fehler beim Bot-Start:', errMsg);
    
    // Fehler reaktiv in der DB speichern, damit die UI ihn sofort sieht
    await SettingsCollection.upsertAsync(
      { key: 'discord-error-message' }, 
      { $set: { key: 'discord-error-message', value: errMsg } }
    );
  }
};

export const reloadDiscordBot = async () => {
  await initializeDiscordBot();
};