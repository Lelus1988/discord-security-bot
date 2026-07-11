import { SlashCommandBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { ModerationService } from '../../services/ModerationService';
import { guardCommand, replyError } from '../../middleware/permissions';
import { parseDuration, formatDuration } from '../../utils/helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('target').setDescription('The member to mute').setRequired(true))
    .addStringOption(o =>
      o.setName('duration')
        .setDescription('Duration: e.g. 10m, 1h, 2d (max 28d)')
        .setRequired(true)
    )
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.ModerateMembers] });
    await interaction.deferReply({ ephemeral: true });

    const targetUser  = interaction.options.getUser('target', true);
    const durationStr = interaction.options.getString('duration', true);
    const reason      = interaction.options.getString('reason') ?? 'No reason provided';
    const moderator   = interaction.member as GuildMember;
    const guild       = interaction.guild!;

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return replyError(interaction, 'Invalid duration. Use formats like `10m`, `1h`, `2d`.');
    }

    try {
      const target = await guild.members.fetch(targetUser.id);
      await ModerationService.mute(guild, target, moderator, durationMs, reason);
      await interaction.editReply(
        `✅ **${targetUser.tag}** has been muted for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`
      );
    } catch (err) {
      await replyError(interaction, `${err}`);
    }
  },
};

export default command;
