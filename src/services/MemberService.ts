import { Guild, GuildMember, Collection } from 'discord.js';
import { MemberInfo, PresenceStatus } from '../types';
import { UserModel } from '../database/models/User';
import { config } from '../config';

function getStatus(member: GuildMember): PresenceStatus {
  const status = member.presence?.status;
  if (status === 'online' || status === 'idle' || status === 'dnd') return status;
  return 'offline';
}

// ── Short-lived cache for full member fetches ──────────────────────────────
// guild.members.fetch() sends a gateway "request guild members" (opcode 8),
// which Discord rate-limits if called repeatedly in quick succession (e.g.
// the dashboard loading the Overview and Members tab around the same time).
//
// We cache the in-flight PROMISE itself (not just the resolved result), so
// that two requests arriving at nearly the same moment — before the first
// one has even resolved — both await the same underlying gateway request
// instead of each triggering their own (which is what caused the rate limit).
const MEMBER_CACHE_TTL_MS = 10_000;
const memberCache = new Map<string, { promise: Promise<Collection<string, GuildMember>>; expires: number }>();

function fetchAllMembersCached(guild: Guild, force = false): Promise<Collection<string, GuildMember>> {
  const cached = memberCache.get(guild.id);
  if (!force && cached && cached.expires > Date.now()) {
    return cached.promise;
  }

  const promise = guild.members.fetch();
  memberCache.set(guild.id, { promise, expires: Date.now() + MEMBER_CACHE_TTL_MS });

  // If the fetch fails, evict immediately so the next call retries instead of
  // repeatedly returning the same rejected promise until the TTL expires.
  promise.catch(() => memberCache.delete(guild.id));

  return promise;
}

export class MemberService {

  /**
   * Fetch all members of a guild with live presence + role data.
   * Requires GuildMembers + GuildPresences intents.
   */
  static async listMembers(guild: Guild, force = false): Promise<MemberInfo[]> {
    const members = await fetchAllMembersCached(guild, force);
    const mutedUsers = await UserModel.find({ guildId: guild.id, isMuted: true }).lean();
    const mutedIds = new Set(mutedUsers.map(u => u.userId));

    return [...members.values()]
      .map((member): MemberInfo => ({
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        displayName: member.displayName,
        avatarUrl: member.user.displayAvatarURL({ size: 64 }),
        status: getStatus(member),
        isBot: member.user.bot,
        joinedAt: member.joinedAt?.toISOString() ?? null,
        roles: member.roles.cache
          .filter(r => r.id !== guild.id) // exclude @everyone
          .sort((a, b) => b.position - a.position)
          .map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
        isOwner: member.id === config.ownerId || member.id === guild.ownerId,
        isMuted: mutedIds.has(member.id) || member.communicationDisabledUntil !== null,
      }))
      // Online members first, then alphabetically
      .sort((a, b) => {
        const order: Record<PresenceStatus, number> = { online: 0, idle: 1, dnd: 2, offline: 3 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return a.displayName.localeCompare(b.displayName);
      });
  }

  /** Quick stats for the overview tab. */
  static async getStats(guild: Guild) {
    const members = await fetchAllMembersCached(guild);
    const online = [...members.values()].filter(m => {
      const s = m.presence?.status;
      return s === 'online' || s === 'idle' || s === 'dnd';
    }).length;
    const bots = [...members.values()].filter(m => m.user.bot).length;

    return {
      totalMembers: guild.memberCount,
      onlineMembers: online,
      botCount: bots,
      humanCount: guild.memberCount - bots,
      channelCount: guild.channels.cache.size,
      roleCount: guild.roles.cache.size,
      boostLevel: guild.premiumTier,
      boostCount: guild.premiumSubscriptionCount ?? 0,
      createdAt: guild.createdAt.toISOString(),
      iconUrl: guild.iconURL({ size: 128 }),
    };
  }
}
