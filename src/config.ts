import { config as dotenvConfig } from 'dotenv';
import { BotConfig } from './types';

dotenvConfig();

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional_env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config: BotConfig = {
  token:             require_env('DISCORD_TOKEN'),
  clientId:          require_env('CLIENT_ID'),
  clientSecret:      require_env('CLIENT_SECRET'),
  ownerId:           optional_env('OWNER_ID', '1454112721174921343'),
  allowedGuilds:     optional_env('ALLOWED_GUILDS', '').split(',').map(s => s.trim()).filter(Boolean),
  autoLeave:         optional_env('AUTO_LEAVE', 'true') === 'true',
  mongoUri:          optional_env('MONGO_URI', 'mongodb://localhost:27017/securitybot'),
  webPort:           parseInt(optional_env('WEB_PORT', '3000'), 10),
  sessionSecret:     optional_env('SESSION_SECRET', 'changeme_session_secret'),
  oauth2RedirectUri: optional_env('OAUTH2_REDIRECT_URI', 'http://localhost:3000/auth/callback'),

  antiRaid: {
    enabled:            optional_env('ANTI_RAID_ENABLED', 'true') === 'true',
    joinThreshold:      parseInt(optional_env('ANTI_RAID_JOIN_THRESHOLD', '5'), 10),
    windowSec:          parseInt(optional_env('ANTI_RAID_WINDOW_SEC', '10'), 10),
    lockdownDurationSec: parseInt(optional_env('ANTI_RAID_LOCKDOWN_SEC', '300'), 10),
  },

  antiSpam: {
    enabled:         optional_env('ANTI_SPAM_ENABLED', 'true') === 'true',
    msgThreshold:    parseInt(optional_env('ANTI_SPAM_MSG_THRESHOLD', '5'), 10),
    windowSec:       parseInt(optional_env('ANTI_SPAM_WINDOW_SEC', '10'), 10),
    mentionLimit:    parseInt(optional_env('ANTI_SPAM_MENTION_LIMIT', '5'), 10),
    muteDurationMs:  parseInt(optional_env('ANTI_SPAM_MUTE_DURATION_MS', '300000'), 10),
  },
};
