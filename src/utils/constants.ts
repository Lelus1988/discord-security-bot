/**
 * Global constants to avoid magic numbers scattered throughout the codebase.
 */

// ─── Time Constants ───────────────────────────────────────────────────────
export const TIME = {
  // Discord limits
  MAX_TIMEOUT_MS: 28 * 24 * 60 * 60 * 1000,  // Max timeout duration for member.timeout()
  BULK_DELETE_MAX_AGE_MS: 14 * 24 * 60 * 60 * 1000,  // Max age for bulk delete

  // Account age checks
  ACCOUNT_AGE_WEEKS_7_MS: 7 * 24 * 60 * 60 * 1000,
  ACCOUNT_AGE_WEEKS_4_MS: 4 * 24 * 60 * 60 * 1000,
  ACCOUNT_AGE_WEEKS_2_MS: 2 * 24 * 60 * 60 * 1000,
  ACCOUNT_AGE_DAYS_7_MS: 7 * 24 * 60 * 60 * 1000,
  ACCOUNT_AGE_DAYS_30_MS: 30 * 24 * 60 * 60 * 1000,

  // Session
  SESSION_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,  // 7 days

  // Notification auto-delete
  NOTIFICATION_TIMEOUT_MS: 5000,  // 5 seconds

  // Channel lockdown
  CHANNEL_LOCKDOWN_DELAY_MS: 250,  // Delay between permission edits to avoid rate limits

  // Ticket cleanup
  TICKET_CLEANUP_DELAY_MS: 3000,  // 3 second delay before deleting ticket channel
};

// ─── Validation Constants ──────────────────────────────────────────────────
export const VALIDATION = {
  // Discord ID format - 18 digits
  DISCORD_ID_REGEX: /^\d{18}$/,

  // Snowflake validation (Discord IDs)
  MIN_SNOWFLAKE: BigInt('1'),
  MAX_SNOWFLAKE: BigInt('9223372036854775807'),  // 2^63 - 1
};

// ─── Raid Detection Constants ─────────────────────────────────────────────
export const RAID = {
  // Suspicion score thresholds
  SUSPICION_SCORE_NEW_ACCOUNT_7D: 4,
  SUSPICION_SCORE_NEW_ACCOUNT_30D: 2,
  SUSPICION_SCORE_NO_AVATAR: 2,
  SUSPICION_SCORE_BOT_ACCOUNT: 3,
  SUSPICION_THRESHOLD: 2,  // Auto-kick if score >= this during lockdown

  // Raid trigger thresholds
  JOIN_SCORE_THRESHOLD: 4,
};

// ─── Spam Detection Constants ──────────────────────────────────────────────
export const SPAM = {
  REPEAT_MESSAGE_THRESHOLD: 3,
};

// ─── Cleanup Constants ────────────────────────────────────────────────────
export const CLEANUP = {
  // In-memory tracker cleanup intervals
  RAID_TRACKER_TTL_MS: 24 * 60 * 60 * 1000,  // 24 hours
  SPAM_TRACKER_TTL_MS: 24 * 60 * 60 * 1000,  // 24 hours
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000,  // Run cleanup every hour
};

// ─── Database Constants ────────────────────────────────────────────────────
export const DATABASE = {
  CONNECTION_POOL_MIN: 2,
  CONNECTION_POOL_MAX: 10,
};

// ─── Web Panel Constants ───────────────────────────────────────────────────
export const WEB = {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [],
};
