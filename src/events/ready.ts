import { ActivityType } from 'discord.js';
import { BotEvent, ExtendedClient } from '../types';
import { GuildService } from '../services/GuildService';
import { logger } from '../utils/logger';
import { config } from '../config';

const event: BotEvent = {
  name: 'ready',
  once: true,

  async execute(client: ExtendedClient): Promise<void> {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    // Set presence
    client.user?.setPresence({
      activities: [{ name: '🔒 Protecting servers', type: ActivityType.Watching }],
      status: 'online',
    });

    // ── Whitelist check on startup ────────────────────────────────────────
    if (config.autoLeave) {
      for (const [, guild] of client.guilds.cache) {
        if (!GuildService.isAllowed(guild.id)) {
          logger.security(`Unauthorized guild on startup: "${guild.name}" (${guild.id}) – leaving`);
          await GuildService.leaveGuild(guild, 'Not on whitelist');
          continue;
        }

        // Owner presence check
        const ownerPresent = await GuildService.isOwnerPresent(guild);
        if (!ownerPresent) {
          logger.security(`Owner not in "${guild.name}" (${guild.id}) – leaving`);
          await GuildService.leaveGuild(guild, 'Owner not present');
        }
      }
    }

    logger.info('Startup checks complete. Bot is ready.');
  },
};

export default event;
