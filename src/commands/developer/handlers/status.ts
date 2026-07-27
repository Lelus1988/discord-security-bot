import { ChatInputCommandInteraction } from 'discord.js';
import { version as discordJsVersion } from 'discord.js';
import os from 'os';
import mongoose from 'mongoose';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { measureWebpanelLatency } from '../../../utils/latency';
import { DeveloperService } from '../../../services/DeveloperService';
import { config } from '../../../config';

const BOT_VERSION = process.env.npm_package_version ?? '1.0.0';

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function handleStatus(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient
): Promise<void> {
  const memoryUsage = process.memoryUsage();
  const cpuLoad = os.loadavg()[0];
  const webpanel = await measureWebpanelLatency(config.webPort);
  const dbConnected = mongoose.connection.readyState === 1;

  const totalChannels = client.guilds.cache.reduce(
    (acc, guild) => acc + guild.channels.cache.size,
    0
  );
  const totalUsers = client.guilds.cache.reduce(
    (acc, guild) => acc + (guild.memberCount ?? 0),
    0
  );

  const embed = createDevEmbed(interaction, { title: '📊 Bot Status Übersicht' })
    .addFields(
      { name: 'Bot Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      { name: 'Uptime', value: formatUptime(Date.now() - DeveloperService.getStartedAt()), inline: true },
      { name: 'Bot Version', value: BOT_VERSION, inline: true },
      { name: 'Node.js Version', value: process.version, inline: true },
      { name: 'Discord.js Version', value: `v${discordJsVersion}`, inline: true },
      { name: 'RAM Nutzung', value: formatBytes(memoryUsage.rss), inline: true },
      { name: 'CPU Auslastung (1min)', value: `${cpuLoad.toFixed(2)}`, inline: true },
      {
        name: 'Website Status',
        value: webpanel.online ? '🟢 Online' : '🔴 Offline',
        inline: true,
      },
      {
        name: 'Webpanel Status',
        value: webpanel.online ? `🟢 Online (${webpanel.latencyMs}ms)` : '🔴 Offline',
        inline: true,
      },
      { name: 'Datenbank Status', value: dbConnected ? '🟢 Verbunden' : '🔴 Getrennt', inline: true },
      { name: 'Server (Guilds)', value: `${client.guilds.cache.size}`, inline: true },
      { name: 'Benutzer (gesamt)', value: `${totalUsers}`, inline: true },
      { name: 'Channels (gesamt)', value: `${totalChannels}`, inline: true },
      { name: 'Geladene Commands', value: `${client.commands?.size ?? 0}`, inline: true },
      { name: 'Plattform', value: `${os.platform()} (${os.arch()})`, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}
