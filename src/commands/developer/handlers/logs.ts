import { ChatInputCommandInteraction } from 'discord.js';
import { createDevEmbed } from '../../../utils/devEmbed';
import { DeveloperService } from '../../../services/DeveloperService';
import { LogLevel } from '../../../types/developer';

const LEVEL_EMOJI: Record<LogLevel, string> = {
  INFO: 'ℹ️',
  WARN: '⚠️',
  ERROR: '🚨',
  DEBUG: '🐛',
};

export async function handleLogs(
  interaction: ChatInputCommandInteraction,
  level: LogLevel | undefined
): Promise<void> {
  const logs = DeveloperService.getLogs(level, 20);

  if (logs.length === 0) {
    const embed = createDevEmbed(interaction, { title: '📜 Logs' }).setDescription(
      level ? `Keine Logs mit Level \`${level}\` gefunden.` : 'Keine Logs vorhanden.'
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const lines = logs
    .map(log => {
      const timestamp = `<t:${Math.floor(log.timestamp / 1000)}:T>`;
      return `${LEVEL_EMOJI[log.level]} \`${log.level}\` ${timestamp} — ${log.message}`;
    })
    .join('\n');

  const truncated = lines.length > 3900 ? `${lines.slice(0, 3900)}...` : lines;

  const embed = createDevEmbed(interaction, {
    title: level ? `📜 Logs — Level ${level}` : '📜 Logs (alle Level)',
  }).setDescription(truncated);

  await interaction.editReply({ embeds: [embed] });
}
