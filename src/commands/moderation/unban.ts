import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { ModerationService } from '../../services/ModerationService';
import { guardCommand, replyError } from '../../middleware/permissions';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by their Discord ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('user_id').setDescription('The Discord User ID to unban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the unban').setRequired(false)),

  requiredPermissions: [PermissionFlagsBits.BanMembers],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.BanMembers] });
    await interaction.deferReply({ ephemeral: true });

    const userId    = interaction.options.getString('user_id', true).trim();
    const reason    = interaction.options.getString('reason') ?? 'No reason provided';
    const moderator = interaction.member as GuildMember;
    const guild     = interaction.guild!;

    if (!/^\d{17,20}$/.test(userId)) {
      return replyError(interaction, 'Invalid Discord User ID.');
    }

    try {
      await ModerationService.unban(guild, userId, moderator, reason);
      await interaction.editReply(`✅ User **${userId}** has been unbanned.\n**Reason:** ${reason}`);
    } catch (err) {
      await replyError(interaction, `${err}`);
    }
  },
};

export default command;
