import { Guild, GuildMember, PermissionFlagsBits, OverwriteType } from 'discord.js';
import { RaidTracker } from '../types';
import { GuildModel } from '../database/models/Guild';
import { RaidEventModel } from '../database/models/RaidEvent';
import { LoggingService } from './LoggingService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { isNewAccount, sleep } from '../utils/helpers';

// In-memory raid state per guild
const raidMap = new Map<string, RaidTracker>();

function getTracker(guildId: string): RaidTracker {
  if (!raidMap.has(guildId)) {
    raidMap.set(guildId, { joins: [], lockdownActive: false });
  }
  return raidMap.get(guildId)!;
}

export class RaidService {

  /** Check if anti-raid is enabled for this guild. */
  static async isEnabled(guildId: string): Promise<boolean> {
    const settings = await GuildModel.findOne({ guildId });
    if (settings && settings.antiRaidEnabled !== undefined) return settings.antiRaidEnabled;
    return config.antiRaid.enabled;
  }

  /**
   * Calculate a suspicion score for a newly joined member.
   * Higher score = more suspicious.
   */
  static calculateSuspicionScore(member: GuildMember): number {
    let score = 0;

    // New account (<7 days)
    if (isNewAccount(member.id, 7))  score += 4;
    else if (isNewAccount(member.id, 30)) score += 2;

    // No avatar
    if (!member.user.avatar) score += 2;

    // Bot account
    if (member.user.bot) score += 3;

    return score;
  }

  /**
   * Record a member join and check whether a raid is happening.
   * Returns true if lockdown was triggered.
   */
  static async recordJoin(member: GuildMember): Promise<boolean> {
    const guildId = member.guild.id;
    if (!await this.isEnabled(guildId)) return false;

    const tracker = getTracker(guildId);

    // Skip if already in lockdown
    if (tracker.lockdownActive) {
      // Auto-kick suspicious newcomers during lockdown
      const score = this.calculateSuspicionScore(member);
      if (score >= 2) {
        try { await member.kick('Joined during raid lockdown'); } catch { /* noop */ }
      }
      return false;
    }

    const now = Date.now();
    const settings = await GuildModel.findOne({ guildId });
    const windowMs    = (settings?.windowSec ?? config.antiRaid.windowSec) * 1000;
    const threshold   = settings?.joinThreshold ?? config.antiRaid.joinThreshold;

    // Add this join and prune old entries
    tracker.joins.push(now);
    tracker.joins = tracker.joins.filter(t => now - t < windowMs);

    // Score-based check
    const suspicionScore = this.calculateSuspicionScore(member);
    if (tracker.joins.length >= threshold || (tracker.joins.length >= 3 && suspicionScore >= 4)) {
      await this.activateLockdown(member.guild, tracker, tracker.joins.length);
      return true;
    }

    return false;
  }

  /** Lock down the guild: revoke @everyone send permissions. */
  static async activateLockdown(guild: Guild, tracker: RaidTracker, joinCount: number): Promise<void> {
    if (tracker.lockdownActive) return;
    tracker.lockdownActive = true;
    tracker.lockdownEnd = Date.now() + config.antiRaid.lockdownDurationSec * 1000;

    logger.security(`[RAID] Lockdown activated in "${guild.name}" (${joinCount} joins)`);

    // Save channel permissions before lockdown
    tracker.lockdownRolePerms = new Map();
    const everyoneRole = guild.roles.everyone;

    // Remove send-message & add-reactions from all text channels (skip threads, they have no overwrites)
    for (const [, channel] of guild.channels.cache) {
      if (!channel.isTextBased() || channel.isThread()) continue;
      try {
        const existing = channel.permissionOverwrites.cache.get(everyoneRole.id);
        tracker.lockdownRolePerms!.set(channel.id, existing?.deny.bitfield ?? 0n);

        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
          AddReactions: false,
        }, { reason: 'Anti-Raid lockdown' });
      } catch { /* skip channels without permission */ }
    }

    // Log raid event to DB
    const event = await RaidEventModel.create({
      guildId: guild.id,
      startTime: new Date(),
      joinCount,
      triggered: true,
    });

    await LoggingService.logAndSend(guild, 'RAID', '🚨 RAID DETECTED – LOCKDOWN ACTIVE',
      `${joinCount} joins triggered the raid threshold.`,
      [
        { name: 'Joins Detected', value: `${joinCount}`,                                 inline: true },
        { name: 'Lockdown For',   value: `${config.antiRaid.lockdownDurationSec / 60}m`, inline: true },
        { name: 'Event ID',       value: event.id,                                        inline: true },
      ]
    );

    // Auto-lift lockdown after configured duration
    setTimeout(async () => {
      await this.deactivateLockdown(guild, tracker);
    }, config.antiRaid.lockdownDurationSec * 1000);
  }

  /** Remove lockdown: restore @everyone permissions. */
  static async deactivateLockdown(guild: Guild, tracker?: RaidTracker): Promise<void> {
    const t = tracker ?? getTracker(guild.id);
    if (!t.lockdownActive) return;

    t.lockdownActive = false;
    t.lockdownEnd = undefined;
    t.joins = [];

    const everyoneRole = guild.roles.everyone;

    for (const [, channel] of guild.channels.cache) {
      if (!channel.isTextBased() || channel.isThread()) continue;
      try {
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null,
          AddReactions: null,
        }, { reason: 'Anti-Raid lockdown lifted' });

        await sleep(250); // small delay to avoid rate limits
      } catch { /* skip */ }
    }

    // Update raid event in DB
    await RaidEventModel.findOneAndUpdate(
      { guildId: guild.id, triggered: true, endTime: null },
      { endTime: new Date() },
      { sort: { startTime: -1 } }
    );

    await LoggingService.logAndSend(guild, 'RAID', '✅ Raid Lockdown Lifted',
      'Server is back to normal.',
      [{ name: 'Status', value: 'All channel permissions restored.' }]
    );

    logger.info(`[RAID] Lockdown lifted in "${guild.name}"`);
  }

  /** Check if lockdown is currently active for a guild. */
  static isLockdownActive(guildId: string): boolean {
    return getTracker(guildId).lockdownActive;
  }

  /** Manually trigger or lift lockdown via command. */
  static async toggleLockdown(guild: Guild): Promise<boolean> {
    const tracker = getTracker(guild.id);
    if (tracker.lockdownActive) {
      await this.deactivateLockdown(guild, tracker);
      return false;
    } else {
      await this.activateLockdown(guild, tracker, 0);
      return true;
    }
  }
}
