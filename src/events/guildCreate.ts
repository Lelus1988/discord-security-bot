import { Guild } from 'discord.js';
import { BotEvent } from '../types';
import { GuildService } from '../services/GuildService';
import { logger } from '../utils/logger';
import { config } from '../config';

const event: BotEvent = {
  name: 'guildCreate',

  async execute(guild: Guild): Promise<void> {
    logger.info(`Joined guild: "${guild.name}" (${guild.id})`);

    // ── Whitelist check ───────────────────────────────────────────────────
    if (!GuildService.isAllowed(guild.id)) {
      logger.security(`Guild "${guild.name}" (${guild.id}) not on whitelist – leaving`);
      await GuildService.leaveGuild(guild, 'Not on whitelist');
      return;
    }

    // ── Owner presence check ──────────────────────────────────────────────
    const ownerPresent = await GuildService.isOwnerPresent(guild);
    if (!ownerPresent) {
      logger.security(`Owner not in "${guild.name}" (${guild.id}) – leaving`);
      await GuildService.leaveGuild(guild, 'Owner not present');
      return;
    }

    // Ensure DB settings exist
    await GuildService.getSettings(guild.id);
    logger.info(`Guild "${guild.name}" is authorized. Settings initialized.`);
  },
};

export default event;
