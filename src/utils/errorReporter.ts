import { ChatInputCommandInteraction } from 'discord.js';
import { createDevEmbed } from './devEmbed';
import { logger } from './logger';

interface ErrorContext {
  userId: string;
  username: string;
  commandName: string;
  subcommand: string;
  options?: Record<string, unknown>;
  guildId: string | null;
}

function getErrorSourceFile(stack?: string): string {
  if (!stack) return 'Unbekannt';
  
  const lines = stack.split('\n');
  for (const line of lines) {
    // Suche nach Dateipfaden in der Form "at path/to/file.ts:line:col"
    const match = line.match(/at\s+.*?([\/\\]src[\/\\].+?\.ts):\d+:\d+/);
    if (match) {
      return match[1].replace(/\\/g, '/');
    }
  }
  
  return 'Unbekannt';
}

export function formatErrorDetails(error: unknown, context: ErrorContext): {
  title: string;
  description: string;
  fields: Array<{ name: string; value: string; inline: boolean }>;
} {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const sourceFile = getErrorSourceFile(errorObj.stack);
  
  // Format options string
  const optionsStr = context.options && Object.keys(context.options).length > 0
    ? Object.entries(context.options)
        .map(([key, val]) => `${key}=${val}`)
        .join(', ')
    : '(keine)';

  return {
    title: 'Fehler beim Befehl!',
    description: `Ein Fehler ist während der Ausführung aufgetreten.`,
    fields: [
      {
        name: 'Benutzer',
        value: `${context.username} (\`${context.userId}\`)`,
        inline: false,
      },
      {
        name: 'Befehl',
        value: `\`/${context.commandName} ${context.subcommand}\``,
        inline: false,
      },
      {
        name: 'Parameter',
        value: optionsStr,
        inline: false,
      },
      {
        name: 'Fehler',
        value: `\`\`\`${errorObj.message.slice(0, 1000)}\`\`\``,
        inline: false,
      },
      {
        name: 'Quelle',
        value: `\`${sourceFile}\``,
        inline: false,
      },
    ],
  };
}

/**
 * Sends a detailed error embed to the user and logs the error
 */
export async function reportError(
  interaction: ChatInputCommandInteraction,
  error: unknown,
  context: ErrorContext
): Promise<void> {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const details = formatErrorDetails(error, context);

  // Log to console/file
  logger.error(
    `Fehler in /${context.commandName} ${context.subcommand} (User: ${context.username}): ${errorObj.message}`
  );

  // Create and send embed
  const embed = createDevEmbed(interaction, {
    title: details.title,
    color: 0xed4245,
  }).setDescription(details.description);

  for (const field of details.fields) {
    embed.addFields(field);
  }

  try {
    if (interaction.replied) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (replyErr) {
    logger.error(`Fehler beim Versand der Fehlermeldung: ${replyErr}`);
  }
}

/**
 * Extracts subcommand options for error reporting
 */
export function extractCommandOptions(interaction: ChatInputCommandInteraction): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  
  // Versuche alle möglichen Optionstypen zu extrahieren
  try {
    const optionArray = interaction.options.data;
    
    // Durchsuche alle Optionen und ihre Subcommands
    for (const opt of optionArray) {
      if (opt.type === 1 || opt.type === 2) { // SUBCOMMAND oder SUBCOMMAND_GROUP
        if (opt.options) {
          for (const subOpt of opt.options) {
            options[subOpt.name] = subOpt.value ?? '';
          }
        }
      } else if ('value' in opt) {
        options[opt.name] = opt.value;
      }
    }
  } catch {
    // Fallback: versuche gewöhnliche Methoden
    try {
      const user = interaction.options.getUser('user');
      if (user) options['user'] = user.username;
      
      const level = interaction.options.getString('level');
      if (level) options['level'] = level;
      
      const type = interaction.options.getString('type');
      if (type) options['type'] = type;
      
      const scope = interaction.options.getString('scope');
      if (scope) options['scope'] = scope;
      
      const reason = interaction.options.getString('reason');
      if (reason) options['reason'] = reason.slice(0, 30) + (reason.length > 30 ? '...' : '');
      
      const guildId = interaction.options.getString('guild_id');
      if (guildId) options['guild_id'] = guildId;
    } catch {
      // Silent fallback
    }
  }
  
  return options;
}
