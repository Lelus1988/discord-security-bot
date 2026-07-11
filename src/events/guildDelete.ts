import { Guild } from 'discord.js';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';

const event: BotEvent = {
  name: 'guildDelete',

  async execute(guild: Guild): Promise<void> {
    logger.info(`Removed from guild: "${guild.name}" (${guild.id})`);
    // Guild settings stay in DB for potential re-invite
  },
};

export default event;
