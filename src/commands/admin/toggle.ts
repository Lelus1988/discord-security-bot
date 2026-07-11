import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { GuildService } from '../../services/GuildService';
import { guardCommand, replyError } from '../../middleware/permissions';

// Commands that cannot be toggled off (safety-critical)
const PROTECTED_COMMANDS = ['config', 'guild', 'toggle', 'raid', 'audit'];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('toggle')
    .setDescription('Enable or disable a command for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
      o.setName('command')
        .setDescription('Command name to toggle (without /)')
        .setRequired(true)
    ),

  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(interaction, client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.Administrator] });
    await interaction.deferReply({ ephemeral: true });

    const commandName = interaction.options.getString('command', true).toLowerCase().trim();
    const guildId     = interaction.guildId!;

    if (PROTECTED_COMMANDS.includes(commandName)) {
      return replyError(interaction, `The command \`/${commandName}\` cannot be disabled.`);
    }

    if (!client.commands.has(commandName)) {
      return replyError(interaction, `Unknown command: \`/${commandName}\``);
    }

    const isNowDisabled = await GuildService.toggleCommand(guildId, commandName);
    await interaction.editReply(
      isNowDisabled
        ? `🔴 Command \`/${commandName}\` has been **disabled** for this server.`
        : `🟢 Command \`/${commandName}\` has been **enabled** for this server.`
    );
  },
};

export default command;
