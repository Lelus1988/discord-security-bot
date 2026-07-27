import { ChatInputCommandInteraction } from 'discord.js';
import { createDevEmbed } from '../../../utils/devEmbed';
import { DeveloperService } from '../../../services/DeveloperService';

export async function handleStats(interaction: ChatInputCommandInteraction): Promise<void> {
  const summary = DeveloperService.getUsageSummary();

  if (summary.totalExecutions === 0) {
    const embed = createDevEmbed(interaction, { title: '📈 Command-Statistiken' }).setDescription(
      'Es wurden bisher keine Commands ausgeführt (seit dem letzten Neustart).'
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const perCommandLines = [...summary.perCommand.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => `\`/${name}\` — **${count}x**`)
    .join('\n');

  const perUserLines = [...summary.perUser.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([userId, data]) => `<@${userId}> (${data.username}) — **${data.count}x**`)
    .join('\n');

  const embed = createDevEmbed(interaction, { title: '📈 Command-Statistiken' })
    .addFields(
      { name: 'Gesamt ausgeführte Commands', value: `${summary.totalExecutions}`, inline: false },
      {
        name: 'Meistgenutzter Command',
        value: summary.mostUsedCommand
          ? `\`/${summary.mostUsedCommand}\` (${summary.perCommand.get(summary.mostUsedCommand)}x)`
          : 'Keine Daten',
        inline: false,
      },
      {
        name: 'Aktivster Benutzer',
        value: summary.topUser
          ? `<@${summary.topUser.userId}> (${summary.topUser.username}) — ${summary.topUser.count}x`
          : 'Keine Daten',
        inline: false,
      },
      { name: 'Nutzung pro Command (Top 10)', value: perCommandLines || 'Keine Daten', inline: false },
      { name: 'Nutzung pro Benutzer (Top 10)', value: perUserLines || 'Keine Daten', inline: false }
    );

  await interaction.editReply({ embeds: [embed] });
}

export async function handleStatsForUser(
  interaction: ChatInputCommandInteraction,
  userId: string
): Promise<void> {
  const summary = DeveloperService.getUsageSummary();
  const userCommands = summary.perUserPerCommand.get(userId);

  if (!userCommands || userCommands.size === 0) {
    const embed = createDevEmbed(interaction, { title: '📈 Benutzer-Statistiken' }).setDescription(
      `Keine Nutzungsdaten für <@${userId}> gefunden.`
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const lines = [...userCommands.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `\`/${name}\` — **${count}x**`)
    .join('\n');

  const embed = createDevEmbed(interaction, { title: `📈 Statistiken für <@${userId}>` }).setDescription(
    lines
  );

  await interaction.editReply({ embeds: [embed] });
}
