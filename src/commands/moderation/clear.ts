import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, TextChannel } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { ModerationService } from '../../services/ModerationService';
import { guardCommand, replyError } from '../../middleware/permissions';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk-delete messages in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Number of messages to delete (1–100)')
        .setMinValue(1).setMaxValue(100)
        .setRequired(true)
    ),

  requiredPermissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { requiredPermissions: [PermissionFlagsBits.ManageMessages] });
    await interaction.deferReply({ ephemeral: true });

    const amount    = interaction.options.getInteger('amount', true);
    const moderator = interaction.member as GuildMember;
    const channel   = interaction.channel as TextChannel;

    try {
      const deleted = await ModerationService.clear(channel, amount, moderator);
      const reply = await interaction.editReply(`✅ Deleted **${deleted}** message(s).`);
      setTimeout(() => interaction.deleteReply().catch(() => {}), 4000);
    } catch (err) {
      await replyError(interaction, `${err}`);
    }
  },
};

export default command;
