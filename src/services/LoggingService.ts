import { Guild, EmbedBuilder, TextChannel, Colors } from 'discord.js';
import { LogModel } from '../database/models/Log';
import { GuildModel } from '../database/models/Guild';
import { LogType } from '../types';
import { logger } from '../utils/logger';

const LOG_COLORS: Record<LogType, number> = {
  INFO:     Colors.Blue,
  WARN:     Colors.Yellow,
  SECURITY: Colors.Red,
  RAID:     Colors.DarkRed,
  SPAM:     Colors.Orange,
  MOD:      Colors.Purple,
};

const LOG_EMOJIS: Record<LogType, string> = {
  INFO:     '📋',
  WARN:     '⚠️',
  SECURITY: '🔐',
  RAID:     '🚨',
  SPAM:     '🛑',
  MOD:      '🔨',
};

export class LoggingService {
  /** Persist a log entry to the database. */
  static async log(
    guildId: string,
    type: LogType,
    message: string,
    authorId?: string
  ): Promise<void> {
    try {
      await LogModel.create({ guildId, type, message, authorId });
    } catch (err) {
      logger.error(`Failed to write log to DB: ${err}`);
    }
  }

  /**
   * Send a rich embed to the guild's configured log channel.
   * Silently fails if no channel is configured or if it can't be fetched.
   */
  static async sendToChannel(
    guild: Guild,
    type: LogType,
    title: string,
    fields: { name: string; value: string; inline?: boolean }[],
    authorId?: string
  ): Promise<void> {
    try {
      const settings = await GuildModel.findOne({ guildId: guild.id });
      if (!settings?.logChannelId) return;

      const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const embed = new EmbedBuilder()
        .setTitle(`${LOG_EMOJIS[type]} ${title}`)
        .setColor(LOG_COLORS[type])
        .setTimestamp()
        .addFields(fields);

      if (authorId) {
        embed.setFooter({ text: `Moderator: ${authorId}` });
      }

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`Failed to send log to channel in ${guild.id}: ${err}`);
    }
  }

  /** Fetch the last N logs for a guild. */
  static async getRecentLogs(guildId: string, limit = 10) {
    return LogModel.find({ guildId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /** Convenience: log to both DB and channel. */
  static async logAndSend(
    guild: Guild,
    type: LogType,
    title: string,
    message: string,
    fields: { name: string; value: string; inline?: boolean }[],
    authorId?: string
  ): Promise<void> {
    await Promise.all([
      this.log(guild.id, type, message, authorId),
      this.sendToChannel(guild, type, title, fields, authorId),
    ]);
  }
}
