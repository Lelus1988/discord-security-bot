import { Message, GuildMember } from 'discord.js';
import { SpamTracker } from '../types';
import { GuildModel } from '../database/models/Guild';
import { LoggingService } from './LoggingService';
import { config } from '../config';
import { logger } from '../utils/logger';

// In-memory spam tracking: Map<"guildId:userId", SpamTracker>
const spamMap = new Map<string, SpamTracker>();

const SPAM_LINK_REGEX = /discord\.gg\/[a-zA-Z0-9]+|bit\.ly\/|tinyurl\.com\//i;
const BLOCKED_DOMAINS = ['grabify.link', 'iplogger.org', 'blasze.tk'];

function key(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function getTracker(guildId: string, userId: string): SpamTracker {
  const k = key(guildId, userId);
  if (!spamMap.has(k)) {
    spamMap.set(k, { messages: [], repeatCount: 0 });
  }
  return spamMap.get(k)!;
}

export type SpamReason =
  | 'MESSAGE_FLOOD'
  | 'REPEAT_MESSAGE'
  | 'MASS_MENTION'
  | 'SPAM_LINK'
  | 'BLOCKED_DOMAIN';

export interface SpamResult {
  isSpam: boolean;
  reason?: SpamReason;
}

export class SpamService {

  static async isEnabled(guildId: string): Promise<boolean> {
    const settings = await GuildModel.findOne({ guildId });
    if (settings?.antiSpamEnabled !== undefined) return settings.antiSpamEnabled;
    return config.antiSpam.enabled;
  }

  /** Analyse a message and return whether it's spam + why. */
  static async check(message: Message): Promise<SpamResult> {
    if (!message.guild || !message.member) return { isSpam: false };
    if (!await this.isEnabled(message.guild.id)) return { isSpam: false };

    // Skip admins
    if (message.member.permissions.has('Administrator')) return { isSpam: false };

    const { guild, author, content } = message;
    const tracker = getTracker(guild.id, author.id);
    const now = Date.now();
    const windowMs = config.antiSpam.windowSec * 1000;

    // ── 1. Message flood ──────────────────────────────────────────────────
    tracker.messages.push(now);
    tracker.messages = tracker.messages.filter(t => now - t < windowMs);

    if (tracker.messages.length > config.antiSpam.msgThreshold) {
      return { isSpam: true, reason: 'MESSAGE_FLOOD' };
    }

    // ── 2. Repeat message ─────────────────────────────────────────────────
    if (tracker.lastContent === content) {
      tracker.repeatCount++;
      if (tracker.repeatCount >= 3) {
        return { isSpam: true, reason: 'REPEAT_MESSAGE' };
      }
    } else {
      tracker.repeatCount = 0;
      tracker.lastContent = content;
    }

    // ── 3. Mass mentions ──────────────────────────────────────────────────
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount > config.antiSpam.mentionLimit) {
      return { isSpam: true, reason: 'MASS_MENTION' };
    }

    // ── 4. Spam / invite links ─────────────────────────────────────────────
    if (SPAM_LINK_REGEX.test(content)) {
      return { isSpam: true, reason: 'SPAM_LINK' };
    }

    // ── 5. Blocked domains ────────────────────────────────────────────────
    if (BLOCKED_DOMAINS.some(d => content.includes(d))) {
      return { isSpam: true, reason: 'BLOCKED_DOMAIN' };
    }

    return { isSpam: false };
  }

  /**
   * Handle a detected spam message:
   * delete it, mute the user, log the incident.
   */
  static async handleSpam(message: Message, reason: SpamReason): Promise<void> {
    if (!message.guild || !message.member) return;

    const { guild, member, author } = message;

    // Delete the message
    try { await message.delete(); } catch { /* already deleted */ }

    // Mute via Discord timeout
    try {
      await member.timeout(config.antiSpam.muteDurationMs, `Auto-mute: ${reason}`);
    } catch (err) {
      logger.warn(`Could not mute ${author.tag}: ${err}`);
    }

    // Reset tracker
    const tracker = getTracker(guild.id, author.id);
    tracker.messages = [];
    tracker.repeatCount = 0;

    // Notify in channel (auto-delete after 5s)
    try {
      const channel = message.channel;
      if (channel.isTextBased() && 'send' in channel) {
        const warn = await channel.send(
          `🛑 <@${author.id}> has been muted for **${reason.replace(/_/g, ' ')}**.`
        );
        setTimeout(() => warn.delete().catch(() => {}), 5000);
      }
    } catch { /* noop */ }

    await LoggingService.logAndSend(guild, 'SPAM', 'Spam Detected',
      `${author.tag}: ${reason}`,
      [
        { name: 'User',    value: `<@${author.id}> (${author.tag})`, inline: true },
        { name: 'Reason',  value: reason,                             inline: true },
        { name: 'Channel', value: `<#${message.channelId}>`,         inline: true },
        { name: 'Content', value: message.content.slice(0, 200) || '(no content)' },
      ],
      author.id
    );

    logger.info(`[SPAM] ${author.tag} muted in ${guild.name}: ${reason}`);
  }

  /** Clear spam tracker for a user (e.g. after mute expires). */
  static clearTracker(guildId: string, userId: string): void {
    spamMap.delete(key(guildId, userId));
  }
}
