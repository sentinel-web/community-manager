import { Meteor } from 'meteor/meteor';
import Specializations from '../../api/collections/specializations.collection.js';
import TrainingRequests from '/imports/api/collections/trainingRequest.collection.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function handleInteractions(client, interaction) {
    // 1) Button interactions
  if (interaction.isButton()) {
    const id = interaction.customId || '';
    if (!id.startsWith('claim:')) return;

    const requestId = id.split(':')[1];

    // Instructor in Meteor.users finden (Mapping über Discord ID)
    const instructor = await Meteor.users.findOneAsync(
      { 'profile.discordId': interaction.user.id },
      { fields: { _id: 1 } }
    );

    

    // Request laden
    const req = await TrainingRequests.findOneAsync(requestId);
    if (!req?.requesterDiscordId) {
      await interaction.reply({ content: '❌ Anfrage nicht gefunden.', ephemeral: true });
      return;
    }

    // Schon übernommen?
    if (req.status === 'claimed') {
      await interaction.reply({
        content: `⚠️ Diese Anfrage wurde bereits übernommen.`,
        ephemeral: true
      });
      return;
    }

    // Klickender Instructor in Meteor.users finden (Mapping via profile.discordId)
    const instructorDiscordId = interaction.user.id;
    const instructorUser = await Meteor.users.findOneAsync(
      { 'profile.discordId': instructorDiscordId },
      { fields: { 'profile.name': 1, 'services.username': 1 } }
    );
    const instructorDcIDProof = await Meteor.users.findOneAsync(
      { 'profile.discordId': interaction.user.id },
      { fields: { _id: 1 } }
    );
    if (!instructorDcIDProof?._id) {
      await interaction.reply({
        content: '❌ You dont have the right permissions.',
        ephemeral: true,
      });
      return;
    }

    const instructorName =
      instructorUser?.profile?.name ||
      instructorUser?.services?.username ||
      interaction.user.username;

    // Atomisches Claim: nur übernehmen, wenn status noch "open"
    const updated = await TrainingRequests.updateAsync(
      { _id: requestId, claimedByUserId: { $exists: false } },
      { $set: { claimedByUserId: instructor._id, claimedAt: new Date() } }
    );

    if (updated === 0) {
      await interaction.reply({
        content: '⚠️ Diese Anfrage wurde bereits übernommen.',
        ephemeral: true,
      });
      return;
    }

    // Button deaktivieren + Label ändern (edit reply/update)
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claimed:${requestId}`) // egal, wird eh disabled
        .setLabel(`Übernommen von ${instructorName}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // `update()` editiert die ursprüngliche Nachricht (in DM)
    await interaction.update({ components: [disabledRow] });

    // ✅ Requester informieren per DM
  try {
    const requesterDiscordUser = await client.users.fetch(req.requesterDiscordId);
    await requesterDiscordUser.send({
      content:
        `✅ Deine Ausbildungsanfrage **${req.specializationName ?? 'unbekannt'}** wurde übernommen.\n` +
        `Ausbilder: **${instructorName}**\n` +
        `Bitte warte auf eine Kontaktaufnahme oder schreibe dem Ausbilder direkt.`,
    });
  } catch (e) {
    // nicht kritisch: Requester hat evtl. DMs aus
    console.warn('[Discord] Could not DM requester:', String(e?.message ?? e));
  }

    // Optional: DB-Eintrag am gewünschten Ort (siehe Abschnitt 4)
    return;
  }
  // 2) Slash Command interactions
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'ausbildung') return;

  const keywordRaw = interaction.options.getString('keyword', true).trim();
  const keywordRx = new RegExp(`^${escapeRegex(keywordRaw)}$`, 'i');
  // Find Requester
  const discordUserId = interaction.user.id;

  const appUser = await Meteor.users.findOneAsync(
  { 'profile.discordId': discordUserId },
  { fields: { 'profile.name': 1, 'services.username': 1 } }
);
const requesterName =
  appUser?.profile?.name ||
  appUser?.services?.username ||
  interaction.user.username; // Fallback

  // 1) Spezialisierung holen (async!)
  const specialization = await Specializations.findOneAsync({
    name: { $regex: keywordRx },
  });

  if (!specialization) {
    await interaction.reply({
      content: `❌ Spezialisierung **${keywordRaw}** nicht gefunden.`,
      ephemeral: true,
    });
    return;
  }

  const instructorIds = Array.isArray(specialization.instructors)
    ? specialization.instructors
    : [];

  if (instructorIds.length === 0) {
    await interaction.reply({
      content: `⚠️ Für **${specialization.name}** sind keine Instructor:innen hinterlegt.`,
      ephemeral: true,
    });
    return;
  }

  // 2) Meteor.users async laden
  const instructorDocs = await Meteor.users
    .find(
      { _id: { $in: instructorIds } },
      {
        fields: {
          'profile.discordId': 1,
          'profile.discordName': 1,
          'profile.name': 1,
          'services.username': 1,
        },
      }
    )
    .fetchAsync();

  const targets = instructorDocs
    .map((u) => ({
      userId: u._id,
      discordId: String(u?.profile?.discordId ?? '').trim(),
      display:
        u?.profile?.name ||
        u?.services?.username ||
        u?.profile?.discordName ||
        u._id,
    }))
    .filter((t) => /^\d{15,25}$/.test(t.discordId));

  if (targets.length === 0) {
    await interaction.reply({
      content:
        `⚠️ Instructor:innen gefunden, aber keine gültigen Discord-IDs hinterlegt (Meteor.users.profile.discordId).`,
      ephemeral: true,
    });
    return;
  }

  // Request in DB anlegen
    const requestId = await TrainingRequests.insertAsync({
    status: 'open',
    createdAt: new Date(),

    specializationId: specialization._id,
    specializationName: specialization.name,

    requesterDiscordId: interaction.user.id,
    requesterDiscordName: interaction.user.username,
    requesterName, // dein Name aus Meteor.users

    guildId: interaction.guildId,
    guildName: interaction.guild?.name ?? null,
    });

  // 3) DM-Text
  const msg =
  `📣 **Ausbildungsanfrage**\n` +
  `Spezialisierung: **${specialization.name}**\n` +
  `Von: **${requesterName}**\n` +
  `Discord: ${interaction.user.username}\n` +
  `Server: **${interaction.guild?.name ?? 'unbekannt'}**\n\n` +
  `Bitte melde dich zur Terminabstimmung direkt bei der Person.`;

// Button (customId max ~100 chars, also kurz halten)
const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId(`claim:${requestId}`)
    .setLabel('Übernehmen')
    .setStyle(ButtonStyle.Success)
);

  // 4) DMs senden
  let ok = 0;
  let fail = 0;

  for (const t of targets) {
    try {
      const discordUser = await client.users.fetch(t.discordId);
      await discordUser.send({ content: msg, components: [row] });
      ok++;
    } catch {
      fail++;
    }
  }

  await interaction.reply({
    content:
      `✅ Anfrage für **${specialization.name}** an **${ok}** Instructor:in(nen) gesendet.` +
      (fail ? ` ⚠️ ${fail} DM(s) fehlgeschlagen.` : ''),
    ephemeral: true,
  });
}
