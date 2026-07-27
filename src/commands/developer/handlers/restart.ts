import { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import mongoose from 'mongoose';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { logger } from '../../../utils/logger';

export const RESTART_LOG_CHANNEL_ID = '1520066102074413356';

export async function handleRestart(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  reason: string
): Promise<void> {
  const embed = createDevEmbed(interaction, { title: '🔄 Bot wird neugestartet', color: 0xfee75c })
    .setDescription('Der Bot wird in Kürze neugestartet.')
    .addFields(
      { name: 'Grund', value: reason, inline: false },
      { name: 'Ausgelöst von', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Zeitpunkt', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });

  try {
    const logChannel = await client.channels.fetch(RESTART_LOG_CHANNEL_ID);
    if (logChannel instanceof TextChannel) {
      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    logger.error(`Konnte Restart-Embed nicht in Log-Kanal senden: ${err}`);
  }

  logger.warn(`Bot-Neustart ausgelöst von ${interaction.user.tag} (${interaction.user.id}). Grund: ${reason}`);

  // Sauberes Beenden aller Verbindungen, bevor der Prozess beendet wird.
  // Der eigentliche Neustart übernimmt der Prozess-Manager (z.B. PM2),
  // der den Prozess nach dem Exit automatisch neu startet.
  setTimeout(async () => {
    try {
      await mongoose.connection.close();
    } catch (err) {
      logger.error(`Fehler beim Schließen der Datenbankverbindung: ${err}`);
    }
    client.destroy();
    process.exit(0);
  }, 1500);
}
