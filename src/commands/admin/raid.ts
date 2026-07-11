import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { GuildService } from '../../services/GuildService';
import { RaidService } from '../../services/RaidService';
import { guardCommand, replyError } from '../../middleware/permissions';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Manage the anti-raid protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('enable').setDescription('Enable anti-raid protection'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable anti-raid protection'))
    .addSubcommand(sub => sub.setName('lockdown').setDescription('Manually toggle server lockdown'))
    .addSubcommand(sub => sub.setName('status').setDescription('Show current raid protection status')),

  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.Administrator] });
    await interaction.deferReply({ ephemeral: true });

    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guild   = interaction.guild!;

    if (sub === 'enable') {
      await GuildService.updateSettings(guildId, { antiRaidEnabled: true });
      await interaction.editReply('✅ Anti-raid protection has been **enabled**.');

    } else if (sub === 'disable') {
      await GuildService.updateSettings(guildId, { antiRaidEnabled: false });
      await interaction.editReply('⚠️ Anti-raid protection has been **disabled**.');

    } else if (sub === 'lockdown') {
      const isNowActive = await RaidService.toggleLockdown(guild);
      await interaction.editReply(
        isNowActive
          ? '🔒 **Lockdown ACTIVATED** – all channels are now restricted.'
          : '🔓 **Lockdown LIFTED** – server permissions restored.'
      );

    } else if (sub === 'status') {
      const enabled  = await RaidService.isEnabled(guildId);
      const lockdown = RaidService.isLockdownActive(guildId);
      await interaction.editReply({
        embeds: [{
          title: '🛡️ Anti-Raid Status',
          color: lockdown ? 0xff0000 : enabled ? 0x00ff00 : 0xffff00,
          fields: [
            { name: 'Protection', value: enabled  ? '✅ Enabled'  : '❌ Disabled', inline: true },
            { name: 'Lockdown',   value: lockdown ? '🔒 Active'   : '🔓 Inactive', inline: true },
          ],
        }],
      });
    }
  },
};

export default command;
