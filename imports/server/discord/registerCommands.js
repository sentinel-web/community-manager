import { Meteor } from 'meteor/meteor';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export async function registerAndListCommands() {
  const token = Meteor.settings?.discord?.botToken;
  const clientId = Meteor.settings?.discord?.clientId;
  const guildId = Meteor.settings?.discord?.defaultGuildId;

  console.log('[Discord] settings check:', {
    token: token ? 'SET' : 'MISSING',
    clientId: clientId ?? 'MISSING',
    guildId: guildId ?? 'MISSING',
  });

  if (!token || !clientId || !guildId) {
    throw new Error('settings.json fehlt: discord.botToken / discord.clientId / discord.defaultGuildId');
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('ausbildung')
      .setDescription('Ausbildung anfragen')
      .addStringOption(opt =>
        opt.setName('keyword').setDescription('z.B. Medic').setRequired(true)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('[Discord] Commands PUT ok.');

  const current = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
  console.log('[Discord] Aktuelle Guild-Commands:', current.map(c => c.name));
}
