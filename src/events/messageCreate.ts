import { Message } from 'discord.js';
import { BotEvent } from '../types';
import { GuildService } from '../services/GuildService';
import { SpamService } from '../services/SpamService';
import { CustomCommandService } from '../services/CustomCommandService';

const event: BotEvent = {
  name: 'messageCreate',

  async execute(message: Message): Promise<void> {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    // Ignore unauthorized guilds
    if (!GuildService.isAllowed(message.guild.id)) return;

    // ── Anti-Spam ─────────────────────────────────────────────────────────
    const result = await SpamService.check(message);
    if (result.isSpam && result.reason) {
      await SpamService.handleSpam(message, result.reason);
      return; // message was deleted, don't process further
    }

    // ── Custom Commands (per-guild, configured via web dashboard) ─────────
    await CustomCommandService.handleMessage(message);
  },
};

export default event;
