import {
  Guild, GuildMember, TextChannel, User,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { InfractionModel } from '../database/models/Infraction';
import { UserModel } from '../database/models/User';
import { LoggingService } from './LoggingService';
import { canModerate, relativeTimestamp, formatDuration } from '../utils/helpers';
import { logger } from '../utils/logger';

type ModerationAction = 'BAN' | 'KICK' | 'MUTE';

// Embed styling per action — tweak colors/titles/emojis here.
const ACTION_STYLE: Record<ModerationAction, { title: string; color: number; emoji: string }> = {
  BAN:  { title: 'Du wurdest gebannt',             color: 0xED4245, emoji: '🔨' },
  KICK: { title: 'Du wurdest vom Server entfernt', color: 0xE67E22, emoji: '👢' },
  MUTE: { title: 'Du wurdest stummgeschaltet',     color: 0xF1C40F, emoji: '🔇' },
};

// Optional link buttons — set these env vars to show them, otherwise they're
// simply omitted from the DM (Discord doesn't allow empty action rows).
//   APPEAL_URL  -> e.g. a ticket channel / form for appealing the action
//   RULES_URL   -> e.g. an invite link or web page with the server rules
function buildActionButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = [];

  if (process.env.APPEAL_URL) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('Einspruch einlegen')
        .setEmoji('📨')
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.APPEAL_URL)
    );
  }

  if (process.env.RULES_URL) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('Serverregeln')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.RULES_URL)
    );
  }

  return buttons.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)] : [];
}

// Short cosmetic case code (not persisted) just so the DM has something to
// reference, similar to a ticket/case number.
function generateCaseCode(): string {
  return Date.now().toString(36).toUpperCase().slice(-6);
}

function buildActionDM(
  action: ModerationAction,
  guild: Guild,
  reason: string,
  durationMs?: number
) {
  const style = ACTION_STYLE[action];

  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setTitle(`${style.emoji}  ${style.title}`)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'Server',  value: guild.name,              inline: true },
      { name: 'Fall-ID', value: `#${generateCaseCode()}`, inline: true },
      ...(durationMs ? [{ name: 'Dauer', value: formatDuration(durationMs), inline: true }] : []),
      { name: 'Grund',   value: reason || 'Kein Grund angegeben' },
    )
    .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined })
    .setTimestamp();

  return { embeds: [embed], components: buildActionButtons() };
}

/**
 * Best-effort DM to a moderated user. Never throws — DMs can be disabled,
 * and a failed notification should never block the actual moderation action.
 */
async function sendActionDM(
  target: User | GuildMember,
  action: ModerationAction,
  guild: Guild,
  reason: string,
  durationMs?: number
): Promise<void> {
  try {
    await target.send(buildActionDM(action, guild, reason, durationMs));
  } catch { /* DMs disabled or user unreachable */ }
}

export class ModerationService {

  // ─── BAN ─────────────────────────────────────────────────────────────────

  static async ban(
    guild: Guild,
    target: User | GuildMember,
    moderator: GuildMember,
    reason: string,
    deleteMessageDays = 0
  ): Promise<void> {
    const targetUser = target instanceof GuildMember ? target.user : target;

    // Hierarchy check if target is a member
    if (target instanceof GuildMember) {
      if (!canModerate(moderator, target)) {
        throw new Error('You cannot ban someone with an equal or higher role.');
      }
    }

    // Discord's ban endpoint only accepts 0–7 days (0–604800s) of message
    // purge. Clamp so a caller passing e.g. 14 doesn't throw a DiscordAPIError.
    const maxDeleteSeconds = 7 * 24 * 60 * 60;
    const deleteMessageSeconds = Math.min(Math.max(deleteMessageDays, 0) * 86400, maxDeleteSeconds);

    // Notify before removing them — once banned, the bot and user no longer
    // share a server, and a first-time DM after that point will often fail.
    await sendActionDM(targetUser, 'BAN', guild, reason);

    await guild.members.ban(targetUser.id, { reason, deleteMessageSeconds });

    await InfractionModel.create({
      guildId: guild.id,
      userId: targetUser.id,
      moderatorId: moderator.id,
      type: 'BAN',
      reason,
    });

    await LoggingService.logAndSend(guild, 'MOD', 'Member Banned', reason,
      [
        { name: 'User',      value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`,                       inline: true },
        { name: 'Reason',    value: reason },
      ],
      moderator.id
    );

    logger.info(`[BAN] ${targetUser.tag} banned from ${guild.name} by ${moderator.user.tag}`);
  }

  // ─── KICK ────────────────────────────────────────────────────────────────

  static async kick(
    guild: Guild,
    target: GuildMember,
    moderator: GuildMember,
    reason: string
  ): Promise<void> {
    if (!canModerate(moderator, target)) {
      throw new Error('You cannot kick someone with an equal or higher role.');
    }

    // Notify before removing them, same reasoning as ban().
    await sendActionDM(target, 'KICK', guild, reason);

    await target.kick(reason);

    await InfractionModel.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type: 'KICK',
      reason,
    });

    await LoggingService.logAndSend(guild, 'MOD', 'Member Kicked', reason,
      [
        { name: 'User',      value: `<@${target.id}> (${target.user.tag})`, inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`,                    inline: true },
        { name: 'Reason',    value: reason },
      ],
      moderator.id
    );

    logger.info(`[KICK] ${target.user.tag} kicked from ${guild.name} by ${moderator.user.tag}`);
  }

  // ─── MUTE (Discord Timeout) ───────────────────────────────────────────────

  static async mute(
    guild: Guild,
    target: GuildMember,
    moderator: GuildMember,
    durationMs: number,
    reason: string
  ): Promise<void> {
    if (!canModerate(moderator, target)) {
      throw new Error('You cannot mute someone with an equal or higher role.');
    }

    // Discord timeout max is 28 days, minimum is 0 (don't allow negative input)
    const maxMs = 28 * 24 * 60 * 60 * 1000;
    const clampedMs = Math.min(Math.max(durationMs, 0), maxMs);

    await target.timeout(clampedMs, reason);

    // Timeout doesn't remove the member from the server, so it's safe (and
    // more accurate) to notify only after the timeout actually succeeded.
    await sendActionDM(target, 'MUTE', guild, reason, clampedMs);

    await InfractionModel.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type: 'MUTE',
      reason,
      duration: clampedMs,
    });

    await UserModel.findOneAndUpdate(
      { userId: target.id, guildId: guild.id },
      { isMuted: true, mutedUntil: new Date(Date.now() + clampedMs) },
      { upsert: true }
    );

    const unmuteTime = relativeTimestamp(new Date(Date.now() + clampedMs));

    await LoggingService.logAndSend(guild, 'MOD', 'Member Muted', reason,
      [
        { name: 'User',       value: `<@${target.id}> (${target.user.tag})`, inline: true },
        { name: 'Moderator',  value: `<@${moderator.id}>`,                    inline: true },
        { name: 'Duration',   value: `${Math.round(clampedMs / 60000)}m (ends ${unmuteTime})` },
        { name: 'Reason',     value: reason },
      ],
      moderator.id
    );

    logger.info(`[MUTE] ${target.user.tag} muted in ${guild.name} for ${clampedMs}ms`);
  }

  // ─── UNMUTE ───────────────────────────────────────────────────────────────

  static async unmute(
    guild: Guild,
    target: GuildMember,
    moderator: GuildMember,
    reason = 'Manual unmute'
  ): Promise<void> {
    await target.timeout(null, reason); // null removes timeout

    await UserModel.findOneAndUpdate(
      { userId: target.id, guildId: guild.id },
      { isMuted: false, mutedUntil: null },
      { upsert: true }
    );

    await InfractionModel.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type: 'UNMUTE',
      reason,
    });

    await LoggingService.logAndSend(guild, 'MOD', 'Member Unmuted', reason,
      [
        { name: 'User',      value: `<@${target.id}> (${target.user.tag})`, inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`,                    inline: true },
        { name: 'Reason',    value: reason },
      ],
      moderator.id
    );

    logger.info(`[UNMUTE] ${target.user.tag} unmuted in ${guild.name}`);
  }

  // ─── WARN ────────────────────────────────────────────────────────────────

  static async warn(
    guild: Guild,
    target: GuildMember,
    moderator: GuildMember,
    reason: string
  ): Promise<{ warnCount: number }> {
    if (!canModerate(moderator, target)) {
      throw new Error('You cannot warn someone with an equal or higher role.');
    }

    await InfractionModel.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type: 'WARN',
      reason,
    });

    // Derive the count from the infraction log itself (single source of
    // truth) instead of a separately-incremented counter, which could drift
    // out of sync with reality (e.g. if a warning is ever deleted/pruned).
    const warnCount = await this.getWarnCount(guild.id, target.id);

    await UserModel.findOneAndUpdate(
      { userId: target.id, guildId: guild.id },
      { warnCount },
      { upsert: true }
    );

    // Try to DM the warned user
    try {
      await target.send(
        `⚠️ You have been warned in **${guild.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${warnCount}`
      );
    } catch { /* DMs disabled */ }

    await LoggingService.logAndSend(guild, 'MOD', 'Member Warned', reason,
      [
        { name: 'User',      value: `<@${target.id}> (${target.user.tag})`, inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`,                    inline: true },
        { name: 'Warns',     value: `${warnCount}`,                          inline: true },
        { name: 'Reason',    value: reason },
      ],
      moderator.id
    );

    logger.info(`[WARN] ${target.user.tag} warned in ${guild.name} (total: ${warnCount})`);
    return { warnCount };
  }

  // ─── CLEAR ───────────────────────────────────────────────────────────────

  static async clear(
    channel: TextChannel,
    amount: number,
    moderator: GuildMember
  ): Promise<number> {
    // Discord only allows bulk-delete for messages < 14 days old
    const messages = await channel.messages.fetch({ limit: Math.min(amount, 100) });
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recent = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

    // Discord's bulk-delete endpoint requires between 2 and 100 messages —
    // calling it with 0 or 1 throws. Handle those cases separately.
    let deletedCount: number;
    if (recent.size === 0) {
      deletedCount = 0;
    } else if (recent.size === 1) {
      await recent.first()!.delete();
      deletedCount = 1;
    } else {
      const deleted = await channel.bulkDelete(recent, true);
      deletedCount = deleted.size;
    }

    await LoggingService.logAndSend(channel.guild, 'MOD', 'Messages Cleared', `${deletedCount} messages`,
      [
        { name: 'Channel',   value: `<#${channel.id}>`,         inline: true },
        { name: 'Deleted',   value: `${deletedCount} messages`, inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`,       inline: true },
      ],
      moderator.id
    );

    logger.info(`[CLEAR] ${deletedCount} messages deleted in #${channel.name} by ${moderator.user.tag}`);
    return deletedCount;
  }

  // ─── UNBAN ───────────────────────────────────────────────────────────────

  static async unban(
    guild: Guild,
    userId: string,
    moderator: GuildMember,
    reason: string
  ): Promise<void> {
    await guild.members.unban(userId, reason);

    await InfractionModel.create({
      guildId: guild.id,
      userId,
      moderatorId: moderator.id,
      type: 'UNBAN',
      reason,
    });

    await LoggingService.logAndSend(guild, 'MOD', 'Member Unbanned', reason,
      [
        { name: 'User ID',   value: userId,              inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
        { name: 'Reason',    value: reason },
      ],
      moderator.id
    );

    logger.info(`[UNBAN] User ${userId} unbanned from ${guild.name}`);
  }

  // ─── INFRACTIONS ─────────────────────────────────────────────────────────

  static async getInfractions(guildId: string, userId: string) {
    return InfractionModel.find({ guildId, userId }).sort({ createdAt: -1 }).lean();
  }

  static async getWarnCount(guildId: string, userId: string): Promise<number> {
    return InfractionModel.countDocuments({ guildId, userId, type: 'WARN' });
  }
}