import { ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { measureMongoLatency, measureWebpanelLatency } from '../../../utils/latency';
import { config } from '../../../config';

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export async function handleTest(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient
): Promise<void> {
  const results: TestResult[] = [];

  // Datenbank
  const mongoLatency = await measureMongoLatency();
  results.push({
    name: 'Datenbank (MongoDB)',
    passed: mongoLatency >= 0,
    detail: mongoLatency >= 0 ? `${mongoLatency}ms` : 'Keine Verbindung',
  });

  results.push({
    name: 'MongoDB Latenz',
    passed: mongoLatency >= 0 && mongoLatency < 500,
    detail: mongoLatency >= 0 ? `${mongoLatency}ms (Schwellenwert: 500ms)` : 'n/a',
  });

  // Webpanel API
  const webpanel = await measureWebpanelLatency(config.webPort);
  results.push({
    name: 'Webpanel API',
    passed: webpanel.online,
    detail: webpanel.online ? `${webpanel.latencyMs}ms` : 'Nicht erreichbar',
  });

  // Discord API
  const discordStart = Date.now();
  let discordOk = true;
  try {
    await client.user?.fetch();
  } catch {
    discordOk = false;
  }
  results.push({
    name: 'Discord API',
    passed: discordOk,
    detail: discordOk ? `${Date.now() - discordStart}ms` : 'Fehlerhafte Antwort',
  });

  // Permissions (Client-Berechtigungen im aktuellen Guild, falls vorhanden)
  if (interaction.guild) {
    const me = interaction.guild.members.me;
    const hasBasicPerms = me?.permissions.has(['ViewChannel', 'SendMessages']) ?? false;
    results.push({
      name: 'Permissions (aktueller Server)',
      passed: hasBasicPerms,
      detail: hasBasicPerms ? 'Grundberechtigungen vorhanden' : 'Fehlende Grundberechtigungen',
    });
  } else {
    results.push({ name: 'Permissions', passed: true, detail: 'Kein Server-Kontext (DM)' });
  }

  // Wichtige Bot-Services (Cache-Erreichbarkeit als einfacher Smoke-Test)
  const servicesOk = client.guilds.cache.size >= 0 && !!client.commands;
  results.push({
    name: 'Bot-Services (Command-/Guild-Cache)',
    passed: servicesOk,
    detail: servicesOk ? 'Geladen' : 'Nicht initialisiert',
  });

  const passedCount = results.filter(r => r.passed).length;
  const allPassed = passedCount === results.length;

  const embed = createDevEmbed(interaction, {
    title: allPassed ? '✅ Alle Tests bestanden' : '⚠️ Einige Tests fehlgeschlagen',
    color: allPassed ? 0x57f287 : 0xfee75c,
  })
    .setDescription(`${passedCount}/${results.length} Tests bestanden`)
    .addFields(
      results.map(r => ({
        name: `${r.passed ? '✅' : '❌'} ${r.name}`,
        value: r.detail,
        inline: true,
      }))
    );

  await interaction.editReply({ embeds: [embed] });
}
