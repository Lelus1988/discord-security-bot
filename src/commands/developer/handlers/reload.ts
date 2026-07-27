import { ChatInputCommandInteraction } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { logger } from '../../../utils/logger';

const COMMANDS_ROOT = join(__dirname, '..', '..');

function clearRequireCache(fullPath: string): void {
  delete require.cache[require.resolve(fullPath)];
}

function findCommandFile(commandName: string): string | null {
  let found: string | null = null;

  function search(dirPath: string): void {
    if (found) return;
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      if (statSync(fullPath).isDirectory()) {
        search(fullPath);
      } else if (
        (entry.endsWith('.ts') || entry.endsWith('.js')) &&
        entry.replace(/\.(ts|js)$/, '') === commandName
      ) {
        found = fullPath;
        return;
      }
    }
  }

  search(COMMANDS_ROOT);
  return found;
}

function reloadSingleFile(fullPath: string, client: ExtendedClient): string {
  clearRequireCache(fullPath);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require(fullPath);
  const command = module.default ?? module;

  if (!command?.data?.name) {
    throw new Error(`Datei ${fullPath} enthält keinen gültigen Command (fehlendes .data.name)`);
  }

  client.commands?.set(command.data.name, command);
  return command.data.name;
}

/** Lädt einen einzelnen Command anhand seines Dateinamens neu. */
export async function handleReloadCommand(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  commandName: string
): Promise<void> {
  const fullPath = findCommandFile(commandName);

  if (!fullPath) {
    const embed = createDevEmbed(interaction, {
      title: '❌ Reload fehlgeschlagen',
      color: 0xed4245,
    }).setDescription(`Kein Command mit dem Dateinamen \`${commandName}\` gefunden.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  try {
    const loadedName = reloadSingleFile(fullPath, client);
    logger.info(`Command neu geladen: /${loadedName}`);

    const embed = createDevEmbed(interaction, { title: '✅ Command neu geladen' }).setDescription(
      `Der Command \`/${loadedName}\` wurde erfolgreich neu geladen.`
    );
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Fehler beim Reload von ${commandName}: ${err}`);
    const embed = createDevEmbed(interaction, {
      title: '❌ Reload fehlgeschlagen',
      color: 0xed4245,
    }).setDescription(`Fehler beim Neuladen von \`${commandName}\`:\n\`\`\`${String(err)}\`\`\``);
    await interaction.editReply({ embeds: [embed] });
  }
}

/** Lädt eine ganze Command-Kategorie (Unterordner unter src/commands/) neu. */
export async function handleReloadCategory(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  category: string
): Promise<void> {
  const categoryPath = join(COMMANDS_ROOT, category);

  let entries: string[];
  try {
    entries = readdirSync(categoryPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  } catch {
    const embed = createDevEmbed(interaction, {
      title: '❌ Reload fehlgeschlagen',
      color: 0xed4245,
    }).setDescription(`Kategorie \`${category}\` wurde nicht gefunden.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const reloaded: string[] = [];
  const failed: string[] = [];

  for (const entry of entries) {
    const fullPath = join(categoryPath, entry);
    try {
      reloaded.push(reloadSingleFile(fullPath, client));
    } catch (err) {
      failed.push(`${entry}: ${String(err)}`);
    }
  }

  logger.info(`Kategorie "${category}" neu geladen: ${reloaded.length} Commands, ${failed.length} Fehler`);

  const embed = createDevEmbed(interaction, { title: '✅ Kategorie neu geladen' }).addFields(
    { name: 'Kategorie', value: category, inline: false },
    { name: `Erfolgreich (${reloaded.length})`, value: reloaded.map(c => `\`/${c}\``).join(', ') || '—' },
    ...(failed.length ? [{ name: `Fehlgeschlagen (${failed.length})`, value: failed.join('\n') }] : [])
  );

  await interaction.editReply({ embeds: [embed] });
}

/** Lädt alle Commands aus allen Kategorien neu. */
export async function handleReloadAll(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient
): Promise<void> {
  const reloaded: string[] = [];
  const failed: string[] = [];

  function reloadDir(dirPath: string): void {
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      if (statSync(fullPath).isDirectory()) {
        reloadDir(fullPath);
      } else if (entry.endsWith('.ts') || entry.endsWith('.js')) {
        try {
          reloaded.push(reloadSingleFile(fullPath, client));
        } catch (err) {
          failed.push(`${entry}: ${String(err)}`);
        }
      }
    }
  }

  reloadDir(COMMANDS_ROOT);
  logger.info(`Alle Commands neu geladen: ${reloaded.length} erfolgreich, ${failed.length} Fehler`);

  const embed = createDevEmbed(interaction, { title: '✅ Alle Commands neu geladen' }).addFields(
    { name: 'Erfolgreich', value: `${reloaded.length} Commands`, inline: true },
    { name: 'Fehlgeschlagen', value: `${failed.length} Commands`, inline: true },
    ...(failed.length ? [{ name: 'Fehlerdetails', value: failed.slice(0, 10).join('\n') }] : [])
  );

  await interaction.editReply({ embeds: [embed] });
}
