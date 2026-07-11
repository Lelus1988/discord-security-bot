import { GuildMember } from 'discord.js';
import { BotEvent } from '../types';
import { GuildService } from '../services/GuildService';
import { RaidService } from '../services/RaidService';
import { LoggingService } from '../services/LoggingService';
import { WelcomeService } from '../services/WelcomeService';
import { isNewAccount } from '../utils/helpers';
import { logger } from '../utils/logger';

const event: BotEvent = {
  name: 'guildMemberAdd',

  async execute(member: GuildMember): Promise<void> {
    if (!GuildService.isAllowed(member.guild.id)) return;

    // ── Anti-Raid check ───────────────────────────────────────────────────
    const lockdownTriggered = await RaidService.recordJoin(member);

    if (!lockdownTriggered) {
      // Welcome message (public channel)
      await WelcomeService.sendWelcome(member);

      // Log new join info (staff log channel)
      const newAcc = isNewAccount(member.id, 7);
      await LoggingService.logAndSend(
        member.guild,
        newAcc ? 'WARN' : 'INFO',
        `Member Joined${newAcc ? ' ⚠️ (New Account)' : ''}`,
        `${member.user.tag} joined`,
        [
          { name: 'User',          value: `<@${member.id}> (${member.user.tag})`,         inline: true },
          { name: 'Account Age',   value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'New Account?',  value: newAcc ? '⚠️ Yes' : '✅ No',                   inline: true },
        ]
      );
    }

    logger.debug(`Member joined: ${member.user.tag} in ${member.guild.name}`);
  },
};

export default event;
