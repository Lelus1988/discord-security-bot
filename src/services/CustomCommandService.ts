import { Message, EmbedBuilder } from 'discord.js';
import { CustomCommandModel, ICustomCommand } from '../database/models/CustomCommand';
import { GuildModel } from '../database/models/Guild';
import { logger } from '../utils/logger';

const RESERVED_TRIGGERS = ['ban', 'kick', 'mute', 'warn', 'clear', 'unban', 'config', 'guild', 'toggle', 'raid', 'spam', 'audit', 'ticket'];

export class CustomCommandService {

  /** List all custom commands for a guild. */
  static async list(guildId: string) {
    return CustomCommandModel.find({ guildId }).sort({ trigger: 1 }).lean();
  }

  /** Create a new custom command. Throws if trigger already exists or is reserved. */
  static async create(
    guildId: string,
    trigger: string,
    response: string,
    createdBy: string,
    options: { useEmbed?: boolean; embedColor?: string } = {}
  ): Promise<ICustomCommand> {
    const clean = trigger.toLowerCase().trim().replace(/\s+/g, '');

    if (!clean || clean.length > 32) {
      throw new Error('Command trigger must be 1–32 characters.');
    }
    if (RESERVED_TRIGGERS.includes(clean)) {
      throw new Error(`"${clean}" is a reserved command name and cannot be used.`);
    }

    const existing = await CustomCommandModel.findOne({ guildId, trigger: clean });
    if (existing) {
      throw new Error(`A custom command "${clean}" already exists.`);
    }

    return CustomCommandModel.create({
      guildId,
      trigger: clean,
      response,
      createdBy,
      useEmbed: options.useEmbed ?? false,
      embedColor: options.embedColor ?? '#5865F2',
    });
  }

  /** Update an existing custom command. */
  static async update(
    guildId: string,
    id: string,
    updates: Partial<Pick<ICustomCommand, 'response' | 'useEmbed' | 'embedColor' | 'enabled'>>
  ): Promise<ICustomCommand | null> {
    return CustomCommandModel.findOneAndUpdate({ _id: id, guildId }, { $set: updates }, { new: true });
  }

  /** Delete a custom command. */
  static async delete(guildId: string, id: string): Promise<boolean> {
    const result = await CustomCommandModel.deleteOne({ _id: id, guildId });
    return result.deletedCount > 0;
  }

  /**
   * Check if a message matches a custom command trigger, and execute it if so.
   * Returns true if a command was triggered.
   */
  static async handleMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;

    const settings = await GuildModel.findOne({ guildId: message.guild.id });
    const prefix = settings?.prefix ?? '!';

    if (!message.content.startsWith(prefix)) return false;

    const trigger = message.content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    if (!trigger) return false;

    const command = await CustomCommandModel.findOne({ guildId: message.guild.id, trigger, enabled: true });
    if (!command) return false;

    const text = command.response
      .replaceAll('{user}', `<@${message.author.id}>`)
      .replaceAll('{username}', message.author.username)
      .replaceAll('{server}', message.guild.name)
      .replaceAll('{memberCount}', String(message.guild.memberCount));

    try {
      if (command.useEmbed) {
        const embed = new EmbedBuilder()
          .setDescription(text)
          .setColor(parseInt(command.embedColor.replace('#', ''), 16) || 0x5865F2);
        await message.reply({ embeds: [embed] });
      } else {
        await message.reply({ content: text });
      }

      command.uses += 1;
      await command.save();
    } catch (err) {
      logger.error(`Failed to execute custom command "${trigger}" in ${message.guild.id}: ${err}`);
    }

    return true;
  }
}
