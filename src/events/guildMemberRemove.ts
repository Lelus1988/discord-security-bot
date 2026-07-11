import { GuildMember, PartialGuildMember } from 'discord.js';
import { BotEvent } from '../types';
import { GuildService } from '../services/GuildService';
import { LoggingService } from '../services/LoggingService';
import { WelcomeService } from '../services/WelcomeService';
import { config } from '../config';
import { logger } from '../utils/logger';

const event: BotEvent = {
  name: 'guildMemberRemove',

  async execute(member: GuildMember | PartialGuildMember): Promise<void> {
    // ── OWNER CHECK (always first, takes priority over everything) ─────────
    if (member.id === config.ownerId) {
      logger.security(`Owner left/was kicked from "${member.guild.name}" (${member.guild.id}) – leaving`);
      await GuildService.leaveGuild(member.guild, 'Owner left the server');
      return;
    }

    if (!GuildService.isAllowed(member.guild.id)) return;

    // Leave message (public channel)
    await WelcomeService.sendLeave(member);

    // Log member leave (staff log channel)
    await LoggingService.logAndSend(
      member.guild,
      'INFO',
      'Member Left',
      `${member.user?.tag ?? member.id} left`,
      [
        { name: 'User', value: `<@${member.id}> (${member.user?.tag ?? 'Unknown'})`, inline: true },
      ]
    );
  },
};

export default event;
