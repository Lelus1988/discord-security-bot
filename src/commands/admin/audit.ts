import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { LoggingService } from '../../services/LoggingService';
import { ModerationService } from '../../services/ModerationService';
import { guardCommand, replyError } from '../../middleware/permissions';
import { truncate } from '../../utils/helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('View moderation logs and infractions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('log')
        .setDescription('Show the last N log entries')
        .addIntegerOption(o =>
          o.setName('limit').setDescription('Number of entries (default 10)').setMinValue(1).setMaxValue(25)
        )
    )
    .addSubcommand(sub =>
      sub.setName('user')
        .setDescription('Show infractions for a specific user')
        .addUserOption(o => o.setName('target').setDescription('The user').setRequired(true))
    ),

  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.ModerateMembers] });
    await interaction.deferReply({ ephemeral: true });

    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'log') {
      const limit = interaction.options.getInteger('limit') ?? 10;
      const logs  = await LoggingService.getRecentLogs(guildId, limit);

      if (!logs.length) {
        return void interaction.editReply('No log entries found.');
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Last ${logs.length} Log Entries`)
        .setColor(Colors.Blue)
        .setDescription(
          logs.map((l, i) =>
            `\`${i + 1}.\` **[${l.type}]** ${truncate(l.message, 80)} _(${new Date(l.createdAt).toLocaleDateString()})_`
          ).join('\n')
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'user') {
      const targetUser   = interaction.options.getUser('target', true);
      const infractions  = await ModerationService.getInfractions(guildId, targetUser.id);

      if (!infractions.length) {
        return void interaction.editReply(`No infractions found for **${targetUser.tag}**.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚖️ Infractions for ${targetUser.tag}`)
        .setColor(Colors.Orange)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(
          infractions.slice(0, 10).map((inf, i) =>
            `\`${i + 1}.\` **${inf.type}** by <@${inf.moderatorId}> – ${truncate(inf.reason, 60)} _(${new Date(inf.createdAt).toLocaleDateString()})_`
          ).join('\n')
        )
        .setFooter({ text: `Total: ${infractions.length} infraction(s)` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
