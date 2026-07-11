import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { GuildService } from '../../services/GuildService';
import { guardCommand, replyError } from '../../middleware/permissions';
import { config } from '../../config';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Manage the guild whitelist (owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('whitelist-add')
        .setDescription('Add a guild to the whitelist')
        .addStringOption(o => o.setName('guild_id').setDescription('Guild ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('whitelist-remove')
        .setDescription('Remove a guild from the whitelist')
        .addStringOption(o => o.setName('guild_id').setDescription('Guild ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('whitelist-list')
        .setDescription('Show all whitelisted guild IDs')
    ),

  ownerOnly: true,

  async execute(interaction, _client: ExtendedClient): Promise<void> {
    await guardCommand(interaction, { ownerOnly: true });
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'whitelist-add') {
      const guildId = interaction.options.getString('guild_id', true).trim();
      GuildService.addToWhitelist(guildId);
      await interaction.editReply(`✅ Guild \`${guildId}\` added to the whitelist.`);

    } else if (sub === 'whitelist-remove') {
      const guildId = interaction.options.getString('guild_id', true).trim();
      GuildService.removeFromWhitelist(guildId);
      await interaction.editReply(`✅ Guild \`${guildId}\` removed from the whitelist.`);

    } else if (sub === 'whitelist-list') {
      const list = config.allowedGuilds;
      if (!list.length) {
        await interaction.editReply('No guilds are currently whitelisted.');
      } else {
        await interaction.editReply(`**Whitelisted Guilds (${list.length}):**\n\`\`\`\n${list.join('\n')}\n\`\`\``);
      }
    }
  },
};

export default command;
