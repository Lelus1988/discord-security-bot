import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { ModerationService } from '../../services/ModerationService';
import { guardCommand, replyError } from '../../middleware/permissions';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('target').setDescription('The member to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(true)),

  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.ModerateMembers] });
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('target', true);
    const reason     = interaction.options.getString('reason', true);
    const moderator  = interaction.member as GuildMember;
    const guild      = interaction.guild!;

    try {
      const target = await guild.members.fetch(targetUser.id);
      const { warnCount } = await ModerationService.warn(guild, target, moderator, reason);
      await interaction.editReply(
        `⚠️ **${targetUser.tag}** has been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${warnCount}`
      );
    } catch (err) {
      await replyError(interaction, `${err}`);
    }
  },
};

export default command;
