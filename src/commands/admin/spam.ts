import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { GuildService } from '../../services/GuildService';
import { guardCommand } from '../../middleware/permissions';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('spam')
    .setDescription('Manage the anti-spam protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('enable').setDescription('Enable anti-spam'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable anti-spam'))
    .addSubcommand(sub => sub.setName('status').setDescription('Show anti-spam status')),

  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.Administrator] });
    await interaction.deferReply({ ephemeral: true });

    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'enable') {
      await GuildService.updateSettings(guildId, { antiSpamEnabled: true });
      await interaction.editReply('✅ Anti-spam protection **enabled**.');
    } else if (sub === 'disable') {
      await GuildService.updateSettings(guildId, { antiSpamEnabled: false });
      await interaction.editReply('⚠️ Anti-spam protection **disabled**.');
    } else {
      const settings = await GuildService.getSettings(guildId);
      await interaction.editReply({
        embeds: [{
          title: '🛡️ Anti-Spam Status',
          color: settings.antiSpamEnabled ? 0x00ff00 : 0xffff00,
          fields: [
            { name: 'Protection', value: settings.antiSpamEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          ],
        }],
      });
    }
  },
};

export default command;
