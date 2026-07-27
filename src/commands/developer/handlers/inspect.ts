import { ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';

type InspectRoot = 'client' | 'guild' | 'process' | 'database';

const MAX_OUTPUT_LENGTH = 1500;

function safeGet(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object' && typeof current !== 'function') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'function') return `[Funktion: ${value.name || 'anonym'}] (nicht aufrufbar über /dev inspect)`;

  if (typeof value === 'object') {
    try {
      // Collection-artige Discord.js-Objekte (Map-basiert) verkürzt darstellen
      if (value instanceof Map) {
        return `Map(${value.size}) { ${[...value.keys()].slice(0, 20).join(', ')}${value.size > 20 ? ', ...' : ''} }`;
      }
      const json = JSON.stringify(
        value,
        (_key, val) => (typeof val === 'bigint' ? val.toString() : val),
        2
      );
      return json ?? String(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export async function handleInspect(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  root: InspectRoot,
  path: string
): Promise<void> {
  const pathParts = path
    .split('.')
    .map(p => p.trim())
    .filter(Boolean);

  let rootObject: unknown;

  switch (root) {
    case 'client':
      rootObject = client;
      break;
    case 'guild':
      rootObject = interaction.guild;
      break;
    case 'process':
      // Nur unkritische, bereits öffentlich sichtbare Prozess-Infos - keine env-Variablen.
      rootObject = {
        version: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid,
      };
      break;
    case 'database':
      rootObject = {
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        collections: Object.keys(mongoose.connection.collections),
      };
      break;
  }

  if (rootObject === undefined || rootObject === null) {
    const embed = createDevEmbed(interaction, {
      title: '❌ Inspect fehlgeschlagen',
      color: 0xed4245,
    }).setDescription(
      `Wurzel-Objekt \`${root}\` ist nicht verfügbar (z.B. kein Server-Kontext bei \`guild\`).`
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const result = pathParts.length ? safeGet(rootObject, pathParts) : rootObject;
  const formatted = formatValue(result);
  const truncated =
    formatted.length > MAX_OUTPUT_LENGTH ? `${formatted.slice(0, MAX_OUTPUT_LENGTH)}\n... (gekürzt)` : formatted;

  const embed = createDevEmbed(interaction, { title: '🔍 Inspect-Ergebnis' }).addFields(
    { name: 'Pfad', value: `\`${root}${pathParts.length ? '.' + pathParts.join('.') : ''}\``, inline: false },
    { name: 'Wert', value: `\`\`\`json\n${truncated}\n\`\`\``, inline: false }
  );

  await interaction.editReply({ embeds: [embed] });
}
