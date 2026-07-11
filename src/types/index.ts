import {
  Client, Collection, ChatInputCommandInteraction,
  SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder, PermissionResolvable
} from 'discord.js';

// ─── Extended Client ────────────────────────────────────────────────────────

export interface ExtendedClient extends Client {
  commands: Collection<string, BotCommand>;
}
// ────────────────────────────────

// Any of the builder shapes returned by SlashCommandBuilder once options/subcommands
// have been added — all of them expose .name and
// ─── Commands ───────────────────────────── .toJSON(), which is all the
// command loader and deploy script actually need.
export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder;

export interface BotCommand {
  data: SlashCommandData;
  ownerOnly?: boolean;
  requiredPermissions?: PermissionResolvable[];
  execute: (interaction: ChatInputCommandInteraction, client: ExtendedClient) => Promise<void>;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface BotConfig {
  token: string;
  clientId: string;
  clientSecret: string;
  ownerId: string;
  allowedGuilds: string[];
  autoLeave: boolean;
  mongoUri: string;
  webPort: number;
  sessionSecret: string;
  oauth2RedirectUri: string;
  antiRaid: {
    enabled: boolean;
    joinThreshold: number;
    windowSec: number;
    lockdownDurationSec: number;
  };
  antiSpam: {
    enabled: boolean;
    msgThreshold: number;
    windowSec: number;
    mentionLimit: number;
    muteDurationMs: number;
  };
}

// ─── Guild Settings (stored in DB) ──────────────────────────────────────────

export interface GuildSettings {
  guildId: string;
  antiRaidEnabled: boolean;
  antiSpamEnabled: boolean;
  logChannelId?: string;
  ticketCategoryId?: string;
  modRoleId?: string;
  disabledCommands: string[];
  muteRoleId?: string;
  joinThreshold?: number;
  windowSec?: number;
}

// ─── Infraction Types ────────────────────────────────────────────────────────

export type InfractionType = 'BAN' | 'KICK' | 'MUTE' | 'WARN' | 'UNMUTE' | 'UNBAN';

export interface InfractionData {
  guildId: string;
  userId: string;
  moderatorId: string;
  type: InfractionType;
  reason: string;
  duration?: number; // in ms, for mutes
  timestamp: Date;
}

// ─── In-Memory Raid/Spam Tracking ───────────────────────────────────────────

export interface RaidTracker {
  joins: number[];           // timestamps of recent joins
  lockdownActive: boolean;
  lockdownEnd?: number;      // timestamp when lockdown ends
  lockdownRolePerms?: Map<string, bigint>; // saved permissions before lockdown
}

export interface SpamTracker {
  messages: number[];        // timestamps of recent messages
  lastContent?: string;      // for repeat-message detection
  repeatCount: number;
}

// ─── Web Panel Session ───────────────────────────────────────────────────────

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
  owner: boolean;
}

declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
    user?: DiscordUser;
    guilds?: DiscordGuild[];
  }
}

// ─── Log Types ───────────────────────────────────────────────────────────────

export type LogType = 'INFO' | 'WARN' | 'SECURITY' | 'RAID' | 'SPAM' | 'MOD';

// ─── Webpanel: Live Member / Role Data ──────────────────────────────────────

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface MemberInfo {
  id: string;
  username: string;
  discriminator: string;
  displayName: string;
  avatarUrl: string;
  status: PresenceStatus;
  isBot: boolean;
  joinedAt: string | null;
  roles: { id: string; name: string; color: string }[];
  isOwner: boolean;
  isMuted: boolean;
}

export interface RoleInfo {
  id: string;
  name: string;
  color: string;       // hex string
  position: number;
  hoist: boolean;
  mentionable: boolean;
  managed: boolean;     // true for bot/integration roles (cannot be edited)
  memberCount: number;
  permissions: string;  // bitfield as string
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: 'text' | 'category' | 'voice' | 'announcement' | 'other';
  parentId: string | null;
}

export interface CustomCommandData {
  id: string;
  trigger: string;
  response: string;
  useEmbed: boolean;
  embedColor: string;
  enabled: boolean;
  createdBy: string;
  uses: number;
  createdAt: string;
}
