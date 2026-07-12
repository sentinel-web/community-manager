import { Client, GatewayIntentBits, Partials, PermissionFlagsBits } from 'discord.js';
import { Meteor } from 'meteor/meteor';
import dayjs from 'dayjs'; 
import SettingsCollection from '../../imports/api/collections/settings.collection';
import { decrypt } from '../encryption';
import RegistrationsCollection from '/imports/api/collections/registrations.collection';
import RolesCollection from '/imports/api/collections/roles.collection';
import RanksCollection from '/imports/api/collections/ranks.collection';
import SpecializationsCollection from '../../imports/api/collections/specializations.collection';
import EventsCollection from '/imports/api/collections/events.collection'; 
import EventTypesCollection from '/imports/api/collections/eventTypes.collection'; 

let client: Client | null = null;
let registrationObserverHandle: any = null;
let userObserverHandle: any = null;
let eventObserverHandle: any = null; 
const userMessageHistory = new Map<string, { timestamp: number; content: string; message: any }[]>();

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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildScheduledEvents, // Aktiviert für Event-Interaktionen
        GatewayIntentBits.MessageContent
      ],
      partials: [
        Partials.User, 
        Partials.GuildMember, 
        Partials.GuildScheduledEvent
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
        // RICHTUNG 1: Discord -> Website (User-Rollen)
        // ==========================================
        client!.on('guildMemberUpdate', async (oldMember, newMember) => {
          const oldRoles = Array.from(oldMember.roles.cache.keys());
          const newRoles = Array.from(newMember.roles.cache.keys());
          
          if (oldRoles.length === newRoles.length && oldRoles.every(r => newRoles.includes(r))) return;

          const username = newMember.user.username;
          const fullTag = newMember.user.tag;

          const user = await Meteor.users.findOneAsync({ 
            $or: [
              { 'profile.discordTag': username },
              { 'profile.discordTag': fullTag }
            ]
          });
          if (!user) return;

          const updateFields: Record<string, any> = {};

          const matchingRank = await RanksCollection.findOneAsync({ discordRoleId: { $in: newRoles } } as any);
          if (matchingRank && user.profile!.rankId !== matchingRank._id) {
            updateFields['profile.rankId'] = matchingRank._id;
            console.log(`[Discord -> Web] Rang von ${newMember.user.tag} auf [${matchingRank.name}] aktualisiert.`);
          }

          const matchingRole = await RolesCollection.findOneAsync({ discordRoleId: { $in: newRoles } } as any);
          if (matchingRole && user.profile!.roleId !== matchingRole._id) {
            updateFields['profile.roleId'] = matchingRole._id;
            console.log(`[Discord -> Web] System-Rolle von ${newMember.user.tag} auf [${matchingRole.name}] aktualisiert.`);
          }

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
        // RICHTUNG 1B: Discord-Events -> Website (NEU)
        // ==========================================
        
        // A) User klickt auf "Interessiert"
        client!.on('guildScheduledEventUserAdd', async (scheduledEvent, discordUser) => {
          // FIX: Wenn das User-Objekt unvollständig ist, laden wir die echten Daten (Username, Tag etc.) von Discord nach
          if (discordUser.partial) {
            await discordUser.fetch().catch(console.error);
          }

          console.log(`[Discord-Event] Klick auf "Interessiert" registriert von User: ${discordUser.tag} für Discord-Event-ID: ${scheduledEvent.id}`);
          
          // 1. Passendes Event in der Web-DB suchen
          const webEvent = await EventsCollection.findOneAsync({ discordEventId: scheduledEvent.id } as any);
          if (!webEvent) {
            console.warn(`[Discord-Event] ❌ Kein passendes Webpanel-Event für die Discord-Event-ID [${scheduledEvent.id}] gefunden.`);
            return;
          }

          console.log(`[Discord-Event] 🔍 Passendes Web-Event gefunden: "${webEvent.name}" (${webEvent._id})`);

          // 2. User anhand des Discord-Tags suchen (Case-Insensitive via Regex)
          const user = await Meteor.users.findOneAsync({ 
            $or: [
              { 'profile.discordTag': { $regex: `^${discordUser.username}$`, $options: 'i' } },
              { 'profile.discordTag': { $regex: `^${discordUser.tag}$`, $options: 'i' } }
            ]
          });

          if (!user) {
            console.warn(`[Discord-Event] ❌ Kein registrierter Webpanel-User mit dem Discord-Tag "${discordUser.username}" oder "${discordUser.tag}" in der Datenbank gefunden.`);
            return;
          }

          // 3. In die Teilnehmerliste eintragen
          try {
            await EventsCollection.updateAsync(webEvent._id!, {
              $addToSet: { attendees: user._id }
            } as never);
            console.log(`[Discord -> Web] 🎉 ${user.username} wurde erfolgreich als Teilnehmer für "${webEvent.name}" eingetragen!`);
          } catch (err) {
            console.error(`[Discord -> Web] Fehler beim Aktualisieren der Teilnehmerliste für Event:`, err);
          }
        });

        // B) User entfernt das "Interessiert" wieder
        client!.on('guildScheduledEventUserRemove', async (scheduledEvent, discordUser) => {
          if (discordUser.partial) {
            await discordUser.fetch().catch(console.error);
          }

          console.log(`[Discord-Event] "Interessiert" entfernt von User: ${discordUser.tag} für Discord-Event-ID: ${scheduledEvent.id}`);
          
          const webEvent = await EventsCollection.findOneAsync({ discordEventId: scheduledEvent.id } as any);
          if (!webEvent) return;

          const user = await Meteor.users.findOneAsync({ 
            $or: [
              { 'profile.discordTag': { $regex: `^${discordUser.username}$`, $options: 'i' } },
              { 'profile.discordTag': { $regex: `^${discordUser.tag}$`, $options: 'i' } }
            ]
          });

          if (user) {
            try {
              await EventsCollection.updateAsync(webEvent._id!, {
                $pull: { attendees: user._id }
              } as never);
              console.log(`[Discord -> Web] 📝 ${user.username} wurde erfolgreich aus der Teilnehmerliste von "${webEvent.name}" entfernt.`);
            } catch (err) {
              console.error(`[Discord -> Web] Fehler beim Entfernen aus der Teilnehmerliste:`, err);
            }
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

                const newSpecs: string[] = newSub.profile.specializationIds || [];
                const oldSpecs: string[] = oldSub.profile?.specializationIds || [];
                const addedSpecs = newSpecs.filter(id => !oldSpecs.includes(id));
                const removedSpecs = oldSpecs.filter(id => !newSpecs.includes(id));

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

        // ==========================================
        // AUTOMATIC EVENT ANNOUNCEMENTS (Einmalig geschützt)
        // ==========================================
        let initializingEvents = true;
        eventObserverHandle = EventsCollection.find().observe({
          added: (doc: any) => {
            if (initializingEvents) return;
            
            // 👈 SCHUTZ-WALL 1: Wenn das Event in der DB bereits als angekündigt markiert ist, ignorieren!
            if (doc.isAnnounced === true) return;

            Meteor.defer(async () => {
              try {
                // Zur Sicherheit: Frisch aus der DB holen, falls parallel ein anderer Prozess schreibt
                const freshDoc = await EventsCollection.findOneAsync(doc._id);
                if (!freshDoc || freshDoc.isAnnounced === true) return;

                const eventTypeDoc = await EventTypesCollection.findOneAsync(doc.eventType);
                if (!eventTypeDoc?.createDiscordEvent) return;

                const channelSetting = await SettingsCollection.findOneAsync({ key: 'discord-events-channel-id' });
                const channelId = channelSetting?.value as string | undefined;
                if (!channelId) return;

                const guild = client?.guilds.cache.get(serverId) || await client?.guilds.fetch(serverId).catch(() => null);
                if (!guild) return;

                const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);

                // ------------------------------------------
                // 1. SCHRITT: Echtes Discord-Event anlegen
                // ------------------------------------------
                let discordEventUrl = '';
                try {
                  const startTime = doc.start ? new Date(doc.start) : null;
                  const endTime = doc.end ? new Date(doc.end) : null;

                  if (startTime) {
                    const nowWithBuffer = new Date(Date.now() + 60000);
                    const verifiedStart = startTime < new Date() ? nowWithBuffer : startTime;
                    const verifiedEnd = endTime && endTime > verifiedStart ? endTime : new Date(verifiedStart.getTime() + 3600000);

                    const scheduledEvent = await guild.scheduledEvents.create({
                      name: doc.name,
                      description: doc.description || 'Anmeldung über das Webpanel erforderlich.',
                      scheduledStartTime: verifiedStart,
                      scheduledEndTime: verifiedEnd,
                      privacyLevel: 2, 
                      entityType: 3,   
                      entityMetadata: {
                        location: doc.preset && doc.preset.startsWith('file:') 
                          ? doc.preset.split(':::')[0].replace('file:', '').substring(0, 90)
                          : (doc.preset || 'Webpanel / Arma Server').substring(0, 90)
                      }
                    });

                    discordEventUrl = scheduledEvent.url;
                    console.log(`[Discord Events] Echtes geplantes Event für "${doc.name}" erstellt.`);

                    // Discord Event-ID zurückspeichern
                    await EventsCollection.updateAsync(doc._id, {
                      $set: { discordEventId: scheduledEvent.id }
                    } as never).catch(console.error);
                  }
                } catch (eventCreateError) {
                  console.error('[Discord Events] Fehler beim Erstellen des geplanten Discord-Events:', eventCreateError);
                }

                // ------------------------------------------
                // 2. SCHRITT: Ankündigungs-Nachricht & Datei-Anhang parsen
                // ------------------------------------------
                if (channel && 'send' in channel) {
                  const startTimeStr = doc.start ? dayjs(doc.start).format('DD.MM.YYYY [um] HH:mm [Uhr]') : '-';
                  const endTimeStr = doc.end ? dayjs(doc.end).format('DD.MM.YYYY [um] HH:mm [Uhr]') : '-';

                  let filesPayload: any[] = [];
                  let presetLine = '';

                  if (doc.preset) {
                    if (doc.preset.startsWith('file:')) {
                      try {
                        const [fileMeta, dataUrl] = doc.preset.split(':::');
                        const filename = fileMeta.replace('file:', '');
                        const base64Data = dataUrl.split(',')[1];
                        const buffer = Buffer.from(base64Data, 'base64');
                        
                        filesPayload.push({
                          attachment: buffer,
                          name: filename
                        });
                        presetLine = `📁 **Preset-Datei:** ${filename} (Siehe Anhang 📎)\n`;
                      } catch (err) {
                        console.error('[Discord Events] Fehler beim Verarbeiten des Datei-Anhangs:', err);
                        presetLine = `📁 **Preset-Datei:** Fehler beim Laden\n`;
                      }
                    } else {
                      presetLine = `🔗 **Preset-Link:** ${doc.preset}\n`;
                    }
                  }

                  const messageContent = 
                    `📅 **NEUES COMMUNITY-EVENT** 📅\n` +
                    `--------------------------------------------------\n` +
                    `📝 **Name:** ${doc.name}\n` +
                    `🏷️ **Typ:** ${eventTypeDoc.name}\n` +
                    `⏰ **Start:** ${startTimeStr}\n` +
                    `⏳ **Ende:** ${endTimeStr}\n` +
                    (doc.description ? `📖 **Beschreibung:**\n> ${doc.description}\n` : '') +
                    presetLine + 
                    (discordEventUrl ? `📌 **Discord Event:** ${discordEventUrl}\n` : '') + 
                    `--------------------------------------------------\n` +
                    `👉 *Melde dich jetzt im Webpanel an!*`;

                  await (channel as any).send({ 
                    content: messageContent, 
                    files: filesPayload.length > 0 ? filesPayload : undefined 
                  });
                  console.log(`[Discord Events] Text-Ankündigung für "${doc.name}" gepostet.`);

                  // 👈 SCHUTZ-WALL 2: Jetzt markieren wir das Event unumkehrbar als angekündigt!
                  await EventsCollection.updateAsync(doc._id, {
                    $set: { isAnnounced: true }
                  } as never).catch(console.error);
                }
              } catch (err) {
                console.error('[Discord Events] Fehler beim Verarbeiten des neuen Events:', err);
              }
            });
          }
        });

        // ==========================================
        // SPAMSCHUTZ (NEU)
        // ==========================================
        client!.on('messageCreate', async (message) => {
          try {
            if (message.author.bot) return;

            // Prüfen, ob der Spamschutz in den Einstellungen aktiviert ist
            const spamProtectionSetting = await SettingsCollection.findOneAsync({ key: 'discord-spam-protection-enabled' });
            if (spamProtectionSetting?.value !== true) return;

            // Moderatoren/Admins mit "Manage Messages" Rechten ignorieren
            if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

            const now = Date.now();
            const userId = message.author.id;
            const content = message.content.trim();

            // Prüfen, ob die Nachricht einen Link enthält
            const hasLink = /https?:\/\/\S+|www\.\S+|discord\.gg\/\S+/i.test(content);
            if (!hasLink) return;

            let history = userMessageHistory.get(userId) || [];
            // Nur Nachrichten aus den letzten 15 Sekunden behalten
            history = history.filter(msg => now - msg.timestamp < 15000);

            history.push({ timestamp: now, content, message });
            userMessageHistory.set(userId, history);

            // Duplikats-Schutz für denselben Link: 3 identische Links in 15 Sekunden
            const duplicates = history.filter(msg => msg.content === content);
            if (duplicates.length >= 3) {
              // Alle Duplikate dieses Zyklus löschen
              for (const msg of duplicates) {
                await msg.message.delete().catch(() => {});
              }
              await message.delete().catch(() => {});

              // Stummschalten für 5 Minuten (Timeout)
              if (message.member) {
                await message.member.timeout(5 * 60 * 1000, 'Spamschutz: Link-Spam').catch(console.error);
              }

              const warning = await message.channel.send(`⚠️ <@${message.author.id}> wurde für 5 Minuten stummgeschaltet (Spamschutz: Derselbe Link wurde mehrfach gepostet).`).catch(console.error);
              if (warning) {
                Meteor.setTimeout(() => warning.delete().catch(() => {}), 10000);
              }
              return;
            }
          } catch (err) {
            console.error('[Discord Spamschutz] Fehler:', err);
          }
        });
        
        // Timeout-Sicherheitsnetz für den ersten Serverstart (Zusatzschutz für Minimongo-Sync)
        Meteor.setTimeout(() => {
          initializingEvents = false;
        }, 5000);
        initializingEvents = false;

        resolve();
      });

      client!.login(decryptedToken).catch((err) => {
        reject(err);
      });
    });

  } catch (error) {
    const errMsg = (error as Error).message;
    console.error('[Discord] Fehler beim Bot-Start:', errMsg);
    await SettingsCollection.upsertAsync({ key: 'discord-error-message' }, { $set: { key: 'discord-error-message', value: errMsg } });
  }
};

const cleanUpBot = async () => {
  if (client) {
    await client.destroy().catch(console.error);
    client = null;
  }
  if (registrationObserverHandle && typeof registrationObserverHandle.stop === 'function') {
    registrationObserverHandle.stop();
  }
  registrationObserverHandle = null;

  if (userObserverHandle && typeof userObserverHandle.stop === 'function') {
    userObserverHandle.stop();
  }
  userObserverHandle = null;

  if (eventObserverHandle && typeof eventObserverHandle.stop === 'function') {
    eventObserverHandle.stop();
  }
  eventObserverHandle = null;
  userMessageHistory.clear();
};

export const reloadDiscordBot = async () => {
  await initializeDiscordBot();
};