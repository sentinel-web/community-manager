import { Client, GatewayIntentBits } from 'discord.js';
import { Meteor } from 'meteor/meteor';
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { decrypt } from '../encryption';
import RegistrationsCollection from '/imports/api/collections/registrations.collection';
import RolesCollection from '/imports/api/collections/roles.collection';
import RanksCollection from '/imports/api/collections/ranks.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';

let client: Client | null = null;
let registrationObserverHandle: any = null;
let userObserverHandle: any = null;

export const initializeDiscordBot = async () => {
  const tokenSetting = await SettingsCollection.findOneAsync({ key: 'discord-bot-token' });
  const enabledSetting = await SettingsCollection.findOneAsync({ key: 'discord-enabled' });

  if (enabledSetting?.value !== true || !tokenSetting?.value) {
    await cleanUpBot();
    return;
  }

  try {
    const decryptedToken = decrypt(tokenSetting.value as string);      
    await cleanUpBot();

    client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers 
      ] 
    });

    await new Promise<void>((resolve, reject) => {
      client!.once('ready', async (c) => {
        console.log(`[Discord] Bot erfolgreich eingeloggt als ${c.user.tag}`);
        SettingsCollection.upsertAsync({ key: 'discord-error-message' }, { $set: { key: 'discord-error-message', value: null } }).catch(console.error);
        
        const serverSetting = await SettingsCollection.findOneAsync({ key: 'discord-server-id' });
        const serverId = serverSetting?.value as string | undefined;

        if (!serverId) {
          console.warn('[Discord] Keine Server-ID hinterlegt. Synchronisation abgebrochen.');
          resolve();
          return;
        }

        console.log(`[Discord] Synchronisations-Infrastruktur aktiv für Server: ${serverId}`);

        // ==========================================
        // RICHTUNG 1: Discord -> Website (Inbound)
        // ==========================================
        client!.on('guildMemberUpdate', async (oldMember, newMember) => {
          const oldRoles = Array.from(oldMember.roles.cache.keys());
          const newRoles = Array.from(newMember.roles.cache.keys());
          
          if (oldRoles.length === newRoles.length && oldRoles.every(r => newRoles.includes(r))) return;

          // GEÄNDERT: Wir holen den Usernamen/Tag des Discord-Benutzers
          const username = newMember.user.username;
          const fullTag = newMember.user.tag;

          // Wir suchen in der DB nach dem discordTag (unterstützt neuen Namen & altes Format mit #0000)
          const user = await Meteor.users.findOneAsync({ 
            $or: [
              { 'profile.discordTag': username },
              { 'profile.discordTag': fullTag }
            ]
          });
          if (!user) return;

          const updateFields: Record<string, any> = {};

          // 1. Sync Ränge
          const matchingRank = await RanksCollection.findOneAsync({ discordRoleId: { $in: newRoles } } as any);
          if (matchingRank && user.profile!.rankId !== matchingRank._id) {
            updateFields['profile.rankId'] = matchingRank._id;
            console.log(`[Discord -> Web] Rang von ${newMember.user.tag} auf [${matchingRank.name}] aktualisiert.`);
          }

          // 2. Sync System-Rollen
          const matchingRole = await RolesCollection.findOneAsync({ discordRoleId: { $in: newRoles } } as any);
          if (matchingRole && user.profile!.roleId !== matchingRole._id) {
            updateFields['profile.roleId'] = matchingRole._id;
            console.log(`[Discord -> Web] System-Rolle von ${newMember.user.tag} auf [${matchingRole.name}] aktualisiert.`);
          }

          // 3. Sync Spezialisierungen
          const allSpecs = await SpecializationsCollection.find({ 
            discordRoleId: { $exists: true, $ne: "" } 
          } as any).fetchAsync();
          const currentSpecs: string[] = user.profile!.specializationIds || [];
          let updatedSpecs = [...currentSpecs];
          let specsChanged = false;

          for (const spec of allSpecs) {
            const hasDiscordRole = newRoles.includes(spec.discordRoleId!);
            const hasWebSpec = currentSpecs.includes(spec._id!);

            if (hasDiscordRole && !hasWebSpec) {
              updatedSpecs.push(spec._id!);
              specsChanged = true;
            } else if (!hasDiscordRole && hasWebSpec) {
              updatedSpecs = updatedSpecs.filter(id => id !== spec._id!);
              specsChanged = true;
            }
          }

          if (specsChanged) {
            updateFields['profile.specializationIds'] = updatedSpecs;
            console.log(`[Discord -> Web] Spezialisierungen von ${newMember.user.tag} synchronisiert.`);
          }

          if (Object.keys(updateFields).length > 0) {
            await Meteor.users.updateAsync(user._id, { $set: updateFields });
          }
        });

        // ==========================================
        // RICHTUNG 2: Website -> Discord (Outbound)
        // ==========================================
        let initializingUsers = true;
        userObserverHandle = Meteor.users.find({}, {
          fields: { 'profile.discordTag': 1, 'profile.rankId': 1, 'profile.roleId': 1, 'profile.specializationIds': 1 }
        }).observe({
          changed: (newSub: any, oldSub: any) => {
            if (initializingUsers) return;

            const discordTag = newSub.profile?.discordTag;
            if (!discordTag) return;

            Meteor.defer(async () => {
              try {
                const guild = client?.guilds.cache.get(serverId) || await client?.guilds.fetch(serverId).catch(() => null);
                if (!guild) return;

                let member = guild.members.cache.find(m => m.user.username === discordTag || m.user.tag === discordTag);
                
                if (!member) {
                  const fetchedMembers = await guild.members.fetch({ query: discordTag, limit: 1 }).catch(() => null);
                  member = fetchedMembers?.first();
                }

                if (!member) {
                  console.warn(`[Web -> Discord] Mitglied mit Tag '${discordTag}' nicht auf dem Discord-Server gefunden.`);
                  return;
                }

                // KORREKTUR: Spezialisierungen hier nach oben deklarieren, damit die Logs darauf zugreifen können
                const newSpecs: string[] = newSub.profile.specializationIds || [];
                const oldSpecs: string[] = oldSub.profile?.specializationIds || [];
                const addedSpecs = newSpecs.filter(id => !oldSpecs.includes(id));
                const removedSpecs = oldSpecs.filter(id => !newSpecs.includes(id));

                // DIAGNOSE-LOGS (Jetzt an sicherer Stelle)
               

                // 1. Rang-Rolle abgleichen
                if (newSub.profile.rankId !== oldSub.profile?.rankId) {
                  if (oldSub.profile?.rankId) {
                    const oldRank = await RanksCollection.findOneAsync(oldSub.profile.rankId);
                    if (oldRank?.discordRoleId && guild.roles.cache.has(oldRank.discordRoleId)) {
                      if (member.roles.cache.has(oldRank.discordRoleId)) {
                        await member.roles.remove(oldRank.discordRoleId).catch(console.error);
                      }
                    }
                  }
                  if (newSub.profile.rankId) {
                    const newRank = await RanksCollection.findOneAsync(newSub.profile.rankId);
                    if (newRank?.discordRoleId && guild.roles.cache.has(newRank.discordRoleId)) {
                      if (!member.roles.cache.has(newRank.discordRoleId)) {
                        await member.roles.add(newRank.discordRoleId).catch(console.error);
                      }
                    }
                  }
                }

                // 2. System-Rolle abgleichen
                if (newSub.profile.roleId !== oldSub.profile?.roleId) {
                  if (oldSub.profile?.roleId) {
                    const oldRole = await RolesCollection.findOneAsync(oldSub.profile.roleId);
                    if (oldRole?.discordRoleId && guild.roles.cache.has(oldRole.discordRoleId)) {
                      if (member.roles.cache.has(oldRole.discordRoleId)) {
                        await member.roles.remove(oldRole.discordRoleId).catch(console.error);
                      }
                    }
                  }
                  if (newSub.profile.roleId) {
                    const newRole = await RolesCollection.findOneAsync(newSub.profile.roleId);
                    if (newRole?.discordRoleId && guild.roles.cache.has(newRole.discordRoleId)) {
                      if (!member.roles.cache.has(newRole.discordRoleId)) {
                        await member.roles.add(newRole.discordRoleId).catch(console.error);
                      }
                    }
                  }
                }

                // 3. Spezialisierungs-Rollen abgleichen
                for (const specId of addedSpecs) {
                  const spec = await SpecializationsCollection.findOneAsync(specId);
                  if (spec?.discordRoleId && guild.roles.cache.has(spec.discordRoleId)) {
                    if (!member.roles.cache.has(spec.discordRoleId)) {
                      await member.roles.add(spec.discordRoleId).catch(console.error);
                    }
                  }
                }

                for (const specId of removedSpecs) {
                  const spec = await SpecializationsCollection.findOneAsync(specId);
                  if (spec?.discordRoleId && guild.roles.cache.has(spec.discordRoleId)) {
                    if (member.roles.cache.has(spec.discordRoleId)) {
                      await member.roles.remove(spec.discordRoleId).catch(console.error);
                    }
                  }
                }
              } catch (err) {
                console.error('[Discord Sync] Fehler bei Outbound-Verarbeitung:', err);
              }
            });
          }
        });
        initializingUsers = false;

        // ==========================================
        // RECRUITMENT NOTIFICATIONS (Bestehend)
        // ==========================================
        let initializingRegs = true;
        registrationObserverHandle = RegistrationsCollection.find().observe({
          added: (doc: any) => {
            if (initializingRegs) return;

            Meteor.defer(async () => {
              try {
                const channelSetting = await SettingsCollection.findOneAsync({ key: 'discord-recruitment-channel-id' });
                const channelId = channelSetting?.value as string | undefined;

                if (!channelId) return;

                const guild = client?.guilds.cache.get(serverId) || await client?.guilds.fetch(serverId).catch(() => null);
                const channel = guild?.channels.cache.get(channelId) || await guild?.channels.fetch(channelId).catch(() => null);

                if (channel && 'send' in channel) {
                  const recruiterRoles = await RolesCollection.find({ canManageRecruits: true }).fetchAsync();
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
        initializingRegs = false; 

        resolve();
      });

      client!.login(decryptedToken).catch((err) => {
        reject(err);
      });
    });

  } catch (error) {
    const errMsg = (error as Error).message;
    console.error('[Discord] Fehler beim Bot-Start:', errMsg);
    
    await SettingsCollection.upsertAsync(
      { key: 'discord-error-message' }, 
      { $set: { key: 'discord-error-message', value: errMsg } }
    );
  }
};

const cleanUpBot = async () => {
  if (client) {
    await client.destroy().catch(console.error);
    client = null;
  }
  if (registrationObserverHandle) {
    registrationObserverHandle.stop();
    registrationObserverHandle = null;
  }
  if (userObserverHandle) {
    userObserverHandle.stop();
    userObserverHandle = null;
  }
};

export const reloadDiscordBot = async () => {
  await initializeDiscordBot();
};