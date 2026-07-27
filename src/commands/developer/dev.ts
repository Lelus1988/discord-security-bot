import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { BotCommand, ExtendedClient } from '../../types';
import { guardDeveloperCommand } from '../../middleware/developerGuard';
import { replyError } from '../../middleware/permissions';
import { DeveloperService } from '../../services/DeveloperService';
import { createDevEmbed } from '../../utils/devEmbed';
import { logger } from '../../utils/logger';
import { LogLevel } from '../../types/developer';
import { reportError, extractCommandOptions } from '../../utils/errorReporter';

import { handlePing } from './handlers/ping';
import { handleStatus } from './handlers/status';
import { handleStats, handleStatsForUser } from './handlers/stats';
import { handleReloadCommand, handleReloadCategory, handleReloadAll } from './handlers/reload';
import { handleRestart } from './handlers/restart';
import { handleShutdown } from './handlers/shutdown';
import { handleDatabase } from './handlers/database';
import { handleBackup } from './handlers/backup';
import { handleError } from './handlers/error';
import { handleLogs } from './handlers/logs';
import { handleTest } from './handlers/test';
import { handleEmbedTest } from './handlers/embed';
import { handleGuild } from './handlers/guild';
import { handleSecurityCheck } from './handlers/securityCheck';
import { handleSimulate, SimulationType } from './handlers/simulate';
import { handleInspect } from './handlers/inspect';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('Developer-Commands (nur Entwickler)')

    .addSubcommand(sub => sub.setName('ping').setDescription('Prüft Verbindung/Geschwindigkeit aller Systeme'))

    .addSubcommand(sub => sub.setName('status').setDescription('Vollständige Bot-Status-Übersicht'))

    .addSubcommand(sub =>
      sub
        .setName('stats')
        .setDescription('Statistiken über die Command-Nutzung')
        .addUserOption(o => o.setName('user').setDescription('Statistiken für einen bestimmten Benutzer anzeigen'))
    )

    .addSubcommand(sub =>
      sub
        .setName('reload')
        .setDescription('Lädt Commands neu, ohne den Bot neuzustarten')
        .addStringOption(o =>
          o
            .setName('scope')
            .setDescription('Was soll neu geladen werden?')
            .setRequired(true)
            .addChoices(
              { name: 'Einzelner Command', value: 'command' },
              { name: 'Kategorie', value: 'category' },
              { name: 'Alle Commands', value: 'all' }
            )
        )
        .addStringOption(o => o.setName('name').setDescription('Command- oder Kategoriename (nicht bei "Alle")'))
    )

    .addSubcommand(sub =>
      sub
        .setName('restart')
        .setDescription('Startet den Bot neu')
        .addStringOption(o => o.setName('reason').setDescription('Grund für den Neustart').setRequired(true))
    )

    .addSubcommand(sub =>
      sub
        .setName('shutdown')
        .setDescription('Fährt den Bot vollständig herunter')
        .addStringOption(o => o.setName('reason').setDescription('Grund für das Herunterfahren').setRequired(true))
    )

    .addSubcommand(sub => sub.setName('database').setDescription('Informationen über die aktuelle Datenbank'))

    .addSubcommand(sub => sub.setName('backup').setDescription('Erstellt ein JSON-Backup der Datenbank'))

    .addSubcommand(sub => sub.setName('error').setDescription('Zeigt die letzten kritischen Fehler'))

    .addSubcommand(sub =>
      sub
        .setName('logs')
        .setDescription('Zeigt Terminal-Logs')
        .addStringOption(o =>
          o
            .setName('level')
            .setDescription('Nach Log-Level filtern')
            .addChoices(
              { name: 'INFO', value: 'INFO' },
              { name: 'WARN', value: 'WARN' },
              { name: 'ERROR', value: 'ERROR' },
              { name: 'DEBUG', value: 'DEBUG' }
            )
        )
    )

    .addSubcommand(sub =>
      sub
        .setName('inspect')
        .setDescription('Liest einen Live-Wert aus dem Bot aus (sicherer Ersatz für eval, führt keinen Code aus)')
        .addStringOption(o =>
          o
            .setName('root')
            .setDescription('Wurzel-Objekt')
            .setRequired(true)
            .addChoices(
              { name: 'client', value: 'client' },
              { name: 'guild', value: 'guild' },
              { name: 'process', value: 'process' },
              { name: 'database', value: 'database' }
            )
        )
        .addStringOption(o =>
          o.setName('path').setDescription('Pfad, z.B. "guilds.cache.size" (leer = ganzes Objekt)')
        )
    )

    .addSubcommand(sub => sub.setName('test').setDescription('Führt verschiedene System-Tests durch'))

    .addSubcommand(sub =>
      sub
        .setName('embed')
        .setDescription('Testet ein Discord Embed')
        .addStringOption(o => o.setName('title').setDescription('Titel'))
        .addStringOption(o => o.setName('description').setDescription('Beschreibung'))
        .addStringOption(o => o.setName('color').setDescription('Farbe, z.B. #ff0000'))
        .addStringOption(o => o.setName('footer').setDescription('Footer-Text'))
        .addStringOption(o => o.setName('thumbnail').setDescription('Thumbnail-Bild-URL'))
        .addStringOption(o => o.setName('image').setDescription('Bild-URL'))
        .addStringOption(o => o.setName('fields').setDescription('Fields im Format "Name1|Wert1;Name2|Wert2"'))
    )

    .addSubcommand(sub =>
      sub
        .setName('guild')
        .setDescription('Informationen über einen Server')
        .addStringOption(o => o.setName('guild_id').setDescription('Guild-ID (leer = aktueller Server)'))
    )

    .addSubcommand(sub =>
      sub
        .setName('security-check')
        .setDescription('Prüft die Security-Einstellungen eines Servers')
        .addStringOption(o => o.setName('guild_id').setDescription('Guild-ID (leer = aktueller Server)'))
    )

    .addSubcommand(sub =>
      sub
        .setName('simulate')
        .setDescription('Simuliert ein Security-Event ohne echten Schaden')
        .addStringOption(o =>
          o
            .setName('type')
            .setDescription('Art der Simulation')
            .setRequired(true)
            .addChoices(
              { name: 'Raid', value: 'raid' },
              { name: 'Spam', value: 'spam' },
              { name: 'Nuke', value: 'nuke' },
              { name: 'Join', value: 'join' }
            )
        )
    ),

  ownerOnly: true,

  async execute(interaction, client: ExtendedClient): Promise<void> {
    try {
      await guardDeveloperCommand(interaction);
    } catch (err) {
      await replyError(interaction, (err as Error).message);
      return;
    }

    const sub = interaction.options.getSubcommand();

    try {
      // Defer reply immediately to prevent 3-second timeout
      await interaction.deferReply({ ephemeral: true });

      // Nutzung protokollieren (für /dev stats) - VOR der eigentlichen Ausführung,
      // damit auch fehlgeschlagene Aufrufe gezählt werden.
      DeveloperService.recordCommandUsage({
        commandName: `dev ${sub}`,
        userId: interaction.user.id,
        username: interaction.user.tag,
        guildId: interaction.guildId,
        timestamp: Date.now(),
      });

      switch (sub) {
        case 'ping':
          await handlePing(interaction, client);
          break;

        case 'status':
          await handleStatus(interaction, client);
          break;

        case 'stats': {
          const user = interaction.options.getUser('user');
          if (user) {
            await handleStatsForUser(interaction, user.id);
          } else {
            await handleStats(interaction);
          }
          break;
        }

        case 'reload': {
          const scope = interaction.options.getString('scope', true);
          const name = interaction.options.getString('name');

          if (scope === 'all') {
            await handleReloadAll(interaction, client);
          } else if (scope === 'command') {
            if (!name) {
              await interaction.editReply({ content: '❌ Bitte gib einen Command-Namen an (`name`).' });
              return;
            }
            await handleReloadCommand(interaction, client, name);
          } else if (scope === 'category') {
            if (!name) {
              await interaction.editReply({ content: '❌ Bitte gib eine Kategorie an (`name`), z.B. "developer".' });
              return;
            }
            await handleReloadCategory(interaction, client, name);
          }
          break;
        }

        case 'restart': {
          const reason = interaction.options.getString('reason', true);
          await handleRestart(interaction, client, reason);
          break;
        }

        case 'shutdown': {
          const reason = interaction.options.getString('reason', true);
          await handleShutdown(interaction, client, reason);
          break;
        }

        case 'database':
          await handleDatabase(interaction);
          break;

        case 'backup':
          await handleBackup(interaction);
          break;

        case 'error':
          await handleError(interaction);
          break;

        case 'logs': {
          const level = interaction.options.getString('level') as LogLevel | null;
          await handleLogs(interaction, level ?? undefined);
          break;
        }

        case 'inspect': {
          const root = interaction.options.getString('root', true) as
            | 'client'
            | 'guild'
            | 'process'
            | 'database';
          const path = interaction.options.getString('path') ?? '';
          await handleInspect(interaction, client, root, path);
          break;
        }

        case 'test':
          await handleTest(interaction, client);
          break;

        case 'embed':
          await handleEmbedTest(interaction, {
            title: interaction.options.getString('title'),
            description: interaction.options.getString('description'),
            color: interaction.options.getString('color'),
            footer: interaction.options.getString('footer'),
            thumbnail: interaction.options.getString('thumbnail'),
            image: interaction.options.getString('image'),
            fields: interaction.options.getString('fields'),
          });
          break;

        case 'guild':
          await handleGuild(interaction, client, interaction.options.getString('guild_id'));
          break;

        case 'security-check':
          await handleSecurityCheck(interaction, client, interaction.options.getString('guild_id'));
          break;

        case 'simulate': {
          const type = interaction.options.getString('type', true) as SimulationType;
          await handleSimulate(interaction, client, type);
          break;
        }

        default:
          await interaction.editReply({ content: `❌ Unbekannter Subcommand: ${sub}` });
      }
    } catch (err) {
      // Sammle alle Fehlerinformationen
      const errorContext = {
        userId: interaction.user.id,
        username: interaction.user.tag,
        commandName: 'dev',
        subcommand: sub,
        options: extractCommandOptions(interaction),
        guildId: interaction.guildId,
      };

      // Registriere den Fehler im DeveloperService
      DeveloperService.recordError({
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        area: `dev ${sub} (${interaction.user.tag})`,
      });

      // Sende detaillierte Fehlermeldung an den Benutzer
      await reportError(interaction, err, errorContext);
    }
  },
};

export default command;
