import { ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import { createDevEmbed } from '../../../utils/devEmbed';
import { measureMongoLatency } from '../../../utils/latency';

const READY_STATE_LABELS: Record<number, string> = {
  0: '🔴 Getrennt',
  1: '🟢 Verbunden',
  2: '🟡 Verbindet...',
  3: '🟡 Trennt...',
  99: '⚪ Uninitialisiert',
};

export async function handleDatabase(interaction: ChatInputCommandInteraction): Promise<void> {
  const connection = mongoose.connection;
  const readyState = connection.readyState;
  const latency = await measureMongoLatency();

  let collectionNames: string[] = [];
  let dbStats: { collections: number; dataSize: number; storageSize: number } | null = null;

  if (readyState === 1 && connection.db) {
    try {
      const collections = await connection.db.listCollections().toArray();
      collectionNames = collections.map(c => c.name);
      const stats = await connection.db.stats();
      dbStats = {
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
      };
    } catch {
      // Falls stats()/listCollections() aus Berechtigungsgründen fehlschlagen,
      // zeigen wir trotzdem den Verbindungsstatus an.
    }
  }

  const embed = createDevEmbed(interaction, { title: '🗄️ Datenbank-Informationen' }).addFields(
    { name: 'Typ', value: 'MongoDB (Mongoose)', inline: true },
    { name: 'Verbindungsstatus', value: READY_STATE_LABELS[readyState] ?? 'Unbekannt', inline: true },
    { name: 'Datenbank Ping', value: latency >= 0 ? `${latency}ms` : '❌ Nicht erreichbar', inline: true },
    { name: 'Datenbankname', value: connection.name || '—', inline: true },
    { name: 'Host', value: connection.host || '—', inline: true },
    {
      name: 'Collections',
      value: collectionNames.length ? collectionNames.map(c => `\`${c}\``).join(', ') : '—',
      inline: false,
    },
    ...(dbStats
      ? [
          {
            name: 'Größe (Data / Storage)',
            value: `${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB / ${(
              dbStats.storageSize /
              1024 /
              1024
            ).toFixed(2)} MB`,
            inline: true,
          },
        ]
      : [])
  );

  await interaction.editReply({ embeds: [embed] });
}
