import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { ModerationService } from '../../services/ModerationService';
import { guardCommand, replyError } from '../../middleware/permissions';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('target').setDescription('The member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the kick').setRequired(false)),

  requiredPermissions: [PermissionFlagsBits.KickMembers],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.KickMembers] });
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('target', true);
    const reason     = interaction.options.getString('reason') ?? 'No reason provided';
    const moderator  = interaction.member as GuildMember;
    const guild      = interaction.guild!;

    if (targetUser.id === interaction.user.id) {
      return replyError(interaction, 'You cannot kick yourself.');
    }

    try {
      const target = await guild.members.fetch(targetUser.id);
      await ModerationService.kick(guild, target, moderator, reason);
      await interaction.editReply(`✅ **${targetUser.tag}** has been kicked.\n**Reason:** ${reason}`);
    } catch (err) {
      await replyError(interaction, `${err}`);
    }
  },
};

export default command;
