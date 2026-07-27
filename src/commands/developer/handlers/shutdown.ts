import { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import mongoose from 'mongoose';
import { ExtendedClient } from '../../../types';
import { createDevEmbed } from '../../../utils/devEmbed';
import { logger } from '../../../utils/logger';
import { RESTART_LOG_CHANNEL_ID } from './restart';

export async function handleShutdown(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
  reason: string
): Promise<void> {
  const embed = createDevEmbed(interaction, { title: '🛑 Bot wird heruntergefahren', color: 0xed4245 })
    .setDescription('Der Bot wird vollständig heruntergefahren und muss manuell wieder gestartet werden.')
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
    logger.error(`Konnte Shutdown-Embed nicht in Log-Kanal senden: ${err}`);
  }

  logger.warn(`Bot-Shutdown ausgelöst von ${interaction.user.tag} (${interaction.user.id}). Grund: ${reason}`);

  // Starte Shutdown-Prozess asynchron - nicht auf Interaction warten
  (async () => {
    try {
      // Datenbankverbindung sauber schließen
      await mongoose.connection.close();
      logger.info('Datenbankverbindung geschlossen.');
    } catch (err) {
      logger.error(`Fehler beim Schließen der Datenbankverbindung: ${err}`);
    }

    try {
      // Webpanel/Express-Server beenden, falls über den Client zugänglich
      const server = (client as ExtendedClient & { webpanelServer?: { close: (cb: () => void) => void } })
        .webpanelServer;
      if (server) {
        await new Promise<void>(resolve => server.close(() => resolve()));
        logger.info('Webpanel-Server gestoppt.');
      }
    } catch (err) {
      logger.error(`Fehler beim Stoppen des Webpanels: ${err}`);
    }

    client.destroy();
    logger.info('Discord-Client beendet. Shutdown abgeschlossen.');
    process.exit(0);
  })();
}
