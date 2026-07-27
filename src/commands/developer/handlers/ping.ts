import { ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { measureMongoLatency, measureWebpanelLatency } from '../../../utils/latency';
import { config } from '../../../config';

function formatMs(ms: number): string {
  if (ms < 0) return '❌ Nicht erreichbar';
  return `${ms}ms`;
}

export async function handlePing(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient
): Promise<void> {
  const start = Date.now();
  const dbState = mongoose.connection.readyState;
  const mongoLatency = await measureMongoLatency();
  const webpanel = await measureWebpanelLatency(config.webPort);
  const roundTrip = Date.now() - start;

  const embed = createDevEmbed(interaction, { title: '🏓 Pong! System-Latenzen' }).addFields(
    { name: 'Discord Bot Ping', value: formatMs(roundTrip), inline: true },
    { name: 'Discord Gateway Ping', value: formatMs(Math.round(client.ws.ping)), inline: true },
    { name: 'MongoDB Latenz', value: formatMs(mongoLatency), inline: true },
    {
      name: 'Datenbank Ping',
      value: dbState === 1 ? formatMs(mongoLatency) : '❌ Nicht verbunden',
      inline: true,
    },
    {
      name: 'Website/Webpanel Ping',
      value: webpanel.online ? formatMs(webpanel.latencyMs) : '❌ Nicht erreichbar',
      inline: true,
    }
  );

  await interaction.editReply({ embeds: [embed] });
}
