import { GuildBan } from 'discord.js';
import { BotEvent } from '../types';
import { GuildService } from '../services/GuildService';
import { config } from '../config';
import { logger } from '../utils/logger';

const event: BotEvent = {
  name: 'guildBanAdd',

  async execute(ban: GuildBan): Promise<void> {
    // ── OWNER BANNED ─────────────────────────────────────────────────────
    if (ban.user.id === config.ownerId) {
      logger.security(`Owner was banned from "${ban.guild.name}" (${ban.guild.id}) – leaving`);
      await GuildService.leaveGuild(ban.guild, 'Owner was banned');
    }
  },
};

export default event;
