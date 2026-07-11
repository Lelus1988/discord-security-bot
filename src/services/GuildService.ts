import { Guild } from 'discord.js';
import { GuildModel, IGuild } from '../database/models/Guild';
import { config } from '../config';
import { logger } from '../utils/logger';

export class GuildService {
  /** Return or create settings for a guild. */
  static async getSettings(guildId: string): Promise<IGuild> {
    let settings = await GuildModel.findOne({ guildId });
    if (!settings) {
      settings = await GuildModel.create({ guildId });
      logger.info(`Created settings for guild ${guildId}`);
    }
    return settings;
  }

  /** Update guild settings (partial). */
  static async updateSettings(guildId: string, update: Partial<IGuild>): Promise<IGuild | null> {
    return GuildModel.findOneAndUpdate({ guildId }, { $set: update }, { new: true, upsert: true });
  }

  /** Check if a guild is on the whitelist. */
  static isAllowed(guildId: string): boolean {
    return config.allowedGuilds.includes(guildId);
  }

  /** Add a guild to the in-memory + env whitelist at runtime. */
  static addToWhitelist(guildId: string): void {
    if (!config.allowedGuilds.includes(guildId)) {
      config.allowedGuilds.push(guildId);
      logger.info(`Guild ${guildId} added to whitelist`);
    }
  }

  /** Remove a guild from the in-memory whitelist. */
  static removeFromWhitelist(guildId: string): void {
    config.allowedGuilds = config.allowedGuilds.filter(id => id !== guildId);
    logger.info(`Guild ${guildId} removed from whitelist`);
  }

  /**
   * Check if the owner is still a member of the guild.
   * Tries to fetch the member; returns false if not found.
   */
  static async isOwnerPresent(guild: Guild): Promise<boolean> {
    try {
      await guild.members.fetch(config.ownerId);
      return true;
    } catch {
      return false;
    }
  }

  /** Safely leave a guild and log it. */
  static async leaveGuild(guild: Guild, reason: string): Promise<void> {
    logger.security(`Leaving guild "${guild.name}" (${guild.id}): ${reason}`);
    try {
      await guild.leave();
    } catch (err) {
      logger.error(`Failed to leave guild ${guild.id}: ${err}`);
    }
  }

  /** Check if a command is disabled in this guild. */
  static async isCommandDisabled(guildId: string, commandName: string): Promise<boolean> {
    const settings = await GuildModel.findOne({ guildId });
    return settings?.disabledCommands.includes(commandName) ?? false;
  }

  /** Toggle a command on/off. Returns new state (true = disabled). */
  static async toggleCommand(guildId: string, commandName: string): Promise<boolean> {
    const settings = await this.getSettings(guildId);
    const isDisabled = settings.disabledCommands.includes(commandName);
    if (isDisabled) {
      await GuildModel.updateOne({ guildId }, { $pull: { disabledCommands: commandName } });
      return false;
    } else {
      await GuildModel.updateOne({ guildId }, { $addToSet: { disabledCommands: commandName } });
      return true;
    }
  }
}
