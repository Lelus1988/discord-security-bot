import { GuildMember, PermissionResolvable } from 'discord.js';

/**
 * Parse a duration string like "10m", "1h", "2d" → milliseconds.
 * Returns null if unparseable.
 */
export function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  switch (match[2].toLowerCase()) {
    case 's': return amount * 1_000;
    case 'm': return amount * 60_000;
    case 'h': return amount * 3_600_000;
    case 'd': return amount * 86_400_000;
    default:  return null;
  }
}

/** Format milliseconds as a human-readable string. */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (days > 0)    return `${days}d ${hours % 24}h`;
  if (hours > 0)   return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** Check if a member has a required permission. */
export function hasPermission(member: GuildMember, perm: PermissionResolvable): boolean {
  return member.permissions.has(perm);
}

/**
 * Check role hierarchy: the acting member must be above the target.
 * Returns true if acting CAN moderate target.
 */
export function canModerate(acting: GuildMember, target: GuildMember): boolean {
  // Nobody can moderate the server owner.
  if (target.id === target.guild.ownerId) return false;

  // The server owner always outranks the role hierarchy, even if they
  // happen to hold no roles above @everyone — without this, an owner
  // with no extra roles compares 0 > 0 against an equally role-less
  // target and gets incorrectly blocked.
  if (acting.id === acting.guild.ownerId) return true;

  return acting.roles.highest.position > target.roles.highest.position;
}

/** Sleep for N milliseconds (for rate-limit safety). */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Truncate a string at maxLen and append '…' if needed. */
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

/** Return a Discord-formatted relative timestamp. */
export function relativeTimestamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

/** Check if an account is considered "new" (less than N days old). */
export function isNewAccount(userId: string, thresholdDays = 7): boolean {
  const createdAt = new Date(Number(BigInt(userId) >> 22n) + 1420070400000);
  const ageMs = Date.now() - createdAt.getTime();
  return ageMs < thresholdDays * 86_400_000;
}