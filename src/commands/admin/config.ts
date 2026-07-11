import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { GuildService } from '../../services/GuildService';
import { guardCommand, replyError } from '../../middleware/permissions';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('log-channel')
        .setDescription('Set the log channel')
        .addChannelOption(o => o.setName('channel').setDescription('Log channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('mod-role')
        .setDescription('Set the moderator role')
        .addRoleOption(o => o.setName('role').setDescription('Mod role').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ticket-category')
        .setDescription('Set the category for new ticket channels')
        .addChannelOption(o => o.setName('category').setDescription('Ticket category').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('raid-threshold')
        .setDescription('Override the raid join threshold for this server')
        .addIntegerOption(o =>
          o.setName('threshold').setDescription('Max joins before raid trigger').setRequired(true).setMinValue(2).setMaxValue(50)
        )
        .addIntegerOption(o =>
          o.setName('window').setDescription('Time window in seconds').setRequired(true).setMinValue(5).setMaxValue(120)
        )
    )
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show current settings')
    ),

  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.Administrator] });
    await interaction.deferReply({ ephemeral: true });

    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'log-channel') {
      const channel = interaction.options.getChannel('channel', true);
      await GuildService.updateSettings(guildId, { logChannelId: channel.id });
      await interaction.editReply(`✅ Log channel set to <#${channel.id}>.`);

    } else if (sub === 'mod-role') {
      const role = interaction.options.getRole('role', true);
      await GuildService.updateSettings(guildId, { modRoleId: role.id });
      await interaction.editReply(`✅ Moderator role set to <@&${role.id}>.`);

    } else if (sub === 'ticket-category') {
      const category = interaction.options.getChannel('category', true);
      await GuildService.updateSettings(guildId, { ticketCategoryId: category.id });
      await interaction.editReply(`✅ Ticket category set to **${category.name}**.`);

    } else if (sub === 'raid-threshold') {
      const threshold = interaction.options.getInteger('threshold', true);
      const window    = interaction.options.getInteger('window', true);
      await GuildService.updateSettings(guildId, { joinThreshold: threshold, windowSec: window });
      await interaction.editReply(
        `✅ Raid threshold set: **${threshold} joins / ${window}s**.`
      );

    } else if (sub === 'show') {
      const settings = await GuildService.getSettings(guildId);
      await interaction.editReply({
        embeds: [{
          title: '⚙️ Bot Settings',
          color: 0x5865F2,
          fields: [
            { name: 'Log Channel',      value: settings.logChannelId      ? `<#${settings.logChannelId}>`      : 'Not set', inline: true },
            { name: 'Mod Role',         value: settings.modRoleId         ? `<@&${settings.modRoleId}>`        : 'Not set', inline: true },
            { name: 'Ticket Category',  value: settings.ticketCategoryId  ? `<#${settings.ticketCategoryId}>` : 'Not set', inline: true },
            { name: 'Anti-Raid',        value: settings.antiRaidEnabled ? '✅ Enabled' : '❌ Disabled',         inline: true },
            { name: 'Anti-Spam',        value: settings.antiSpamEnabled ? '✅ Enabled' : '❌ Disabled',         inline: true },
            { name: 'Join Threshold',   value: settings.joinThreshold ? `${settings.joinThreshold} / ${settings.windowSec}s` : 'Default', inline: true },
            { name: 'Disabled Commands', value: settings.disabledCommands.length ? settings.disabledCommands.join(', ') : 'None' },
          ],
        }],
      });
    }
  },
};

export default command;
