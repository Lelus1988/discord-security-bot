import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { ModerationService } from '../../services/ModerationService';
import { guardCommand, replyError } from '../../middleware/permissions';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('target').setDescription('The member to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .addIntegerOption(o =>
      o.setName('delete_days')
        .setDescription('Days of messages to delete (0–7)')
        .setMinValue(0).setMaxValue(7)
        .setRequired(false)
    ),

  requiredPermissions: [PermissionFlagsBits.BanMembers],

  async execute(interaction, client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.BanMembers] });
    await interaction.deferReply({ ephemeral: true });

    const targetUser   = interaction.options.getUser('target', true);
    const reason       = interaction.options.getString('reason') ?? 'No reason provided';
    const deleteDays   = interaction.options.getInteger('delete_days') ?? 0;
    const moderator    = interaction.member as GuildMember;
    const guild        = interaction.guild!;

    // Prevent self-ban
    if (targetUser.id === interaction.user.id) {
      return replyError(interaction, 'You cannot ban yourself.');
    }

    // Prevent banning the bot
    if (targetUser.id === client.user?.id) {
      return replyError(interaction, 'You cannot ban the bot.');
    }

    try {
      const target = await guild.members.fetch(targetUser.id).catch(() => targetUser);
      await ModerationService.ban(guild, target, moderator, reason, deleteDays);
      await interaction.editReply(`✅ **${targetUser.tag}** has been banned.\n**Reason:** ${reason}`);
    } catch (err) {
      await replyError(interaction, `${err}`);
    }
  },
};

export default command;
