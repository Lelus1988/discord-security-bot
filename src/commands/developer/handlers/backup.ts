import { ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import mongoose from 'mongoose';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createDevEmbed } from '../../../utils/devEmbed';
import { logger } from '../../../utils/logger';

const BACKUP_DIR = join(__dirname, '..', '..', '..', '..', 'data', 'backups');
const DISCORD_MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB (Standard-Limit ohne Boost)

export async function handleBackup(interaction: ChatInputCommandInteraction): Promise<void> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    const embed = createDevEmbed(interaction, {
      title: '❌ Backup fehlgeschlagen',
      color: 0xed4245,
    }).setDescription('Keine aktive Datenbankverbindung.');
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const backupData: Record<string, unknown[]> = {};
  for (const { name } of collections) {
    // Interne MongoDB-System-Collections überspringen
    if (name.startsWith('system.')) continue;
    backupData[name] = await db.collection(name).find({}).toArray();
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `backup-${timestamp}.json`;
  const json = JSON.stringify(backupData, null, 2);

  await mkdir(BACKUP_DIR, { recursive: true });
  const filePath = join(BACKUP_DIR, fileName);
  await writeFile(filePath, json, 'utf-8');

  logger.info(`Datenbank-Backup erstellt von ${interaction.user.tag}: ${fileName} (${collections.length} Collections)`);

  const totalDocuments = Object.values(backupData).reduce((acc, docs) => acc + docs.length, 0);
  const sizeBytes = Buffer.byteLength(json, 'utf-8');

  const embed = createDevEmbed(interaction, { title: '💾 Datenbank-Backup erstellt' }).addFields(
    { name: 'Collections', value: `${collections.length}`, inline: true },
    { name: 'Dokumente gesamt', value: `${totalDocuments}`, inline: true },
    { name: 'Dateigröße', value: `${(sizeBytes / 1024).toFixed(1)} KB`, inline: true },
    { name: 'Gespeichert unter', value: `\`data/backups/${fileName}\``, inline: false }
  );

  if (sizeBytes <= DISCORD_MAX_ATTACHMENT_BYTES) {
    const attachment = new AttachmentBuilder(Buffer.from(json, 'utf-8'), { name: fileName });
    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } else {
    embed.addFields({
      name: '⚠️ Hinweis',
      value: 'Die Backup-Datei ist zu groß für einen Discord-Upload und wurde nur lokal gespeichert.',
    });
    await interaction.editReply({ embeds: [embed] });
  }
}
