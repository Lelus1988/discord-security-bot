import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';

export async function handleGuild(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  guildId: string | null
): Promise<void> {
  const targetId = guildId ?? interaction.guildId;

  if (!targetId) {
    const embed = createDevEmbed(interaction, {
      title: '❌ Fehler',
      color: 0xed4245,
    }).setDescription('Keine Guild-ID angegeben und kein Server-Kontext vorhanden.');
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const guild = client.guilds.cache.get(targetId);

  if (!guild) {
    const embed = createDevEmbed(interaction, {
      title: '❌ Server nicht gefunden',
      color: 0xed4245,
    }).setDescription(`Der Bot ist auf keinem Server mit der ID \`${targetId}\`.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const owner = await guild.fetchOwner().catch(() => null);
  const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
  const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
  const categoryChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

  const embed = createDevEmbed(interaction, { title: `🏠 Server-Informationen: ${guild.name}` })
    .setThumbnail(guild.iconURL() ?? null)
    .addFields(
      { name: 'Servername', value: guild.name, inline: true },
      { name: 'Server-ID', value: guild.id, inline: true },
      { name: 'Besitzer', value: owner ? `<@${owner.id}> (${owner.user.tag})` : 'Unbekannt', inline: true },
      { name: 'Mitgliederanzahl', value: `${guild.memberCount}`, inline: true },
      { name: 'Rollen', value: `${guild.roles.cache.size}`, inline: true },
      {
        name: 'Channels',
        value: `${guild.channels.cache.size} gesamt\n(${textChannels} Text, ${voiceChannels} Voice, ${categoryChannels} Kategorien)`,
        inline: true,
      },
      { name: 'Boost-Level', value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} Boosts)`, inline: true },
      { name: 'Erstellt am', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
      { name: 'Bot beigetreten', value: guild.joinedTimestamp ? `<t:${Math.floor(guild.joinedTimestamp / 1000)}:D>` : 'Unbekannt', inline: true },
      { name: 'Verifizierungsstufe', value: `${guild.verificationLevel}`, inline: true },
      { name: 'Region (bevorzugt)', value: guild.preferredLocale, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}
