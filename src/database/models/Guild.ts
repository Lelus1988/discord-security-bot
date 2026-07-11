import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGuild extends Document {
  guildId: string;

  // Protection modules
  antiRaidEnabled: boolean;
  antiSpamEnabled: boolean;
  joinThreshold?: number;
  windowSec?: number;

  // Channels & roles
  logChannelId?: string;
  ticketCategoryId?: string;
  modRoleId?: string;
  muteRoleId?: string;
  disabledCommands: string[];

  // Custom commands
  prefix: string;

  // Welcome message
  welcomeEnabled: boolean;
  welcomeChannelId?: string;
  welcomeMessage: string;
  welcomeUseEmbed: boolean;

  // Leave message
  leaveEnabled: boolean;
  leaveChannelId?: string;
  leaveMessage: string;

  // Rules
  rulesChannelId?: string;
  rulesText: string;

  createdAt: Date;
  updatedAt: Date;
}

const GuildSchema = new Schema<IGuild>(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    antiRaidEnabled: { type: Boolean, default: true },
    antiSpamEnabled: { type: Boolean, default: true },
    joinThreshold:   { type: Number, default: null },
    windowSec:       { type: Number, default: null },

    logChannelId:     { type: String, default: null },
    ticketCategoryId: { type: String, default: null },
    modRoleId:        { type: String, default: null },
    muteRoleId:       { type: String, default: null },
    disabledCommands: { type: [String], default: [] },

    prefix: { type: String, default: '!' },

    welcomeEnabled:   { type: Boolean, default: false },
    welcomeChannelId: { type: String, default: null },
    welcomeMessage:   { type: String, default: "👋 Welcome {user} to **{server}**! You're member #{memberCount}." },
    welcomeUseEmbed:  { type: Boolean, default: true },

    leaveEnabled:   { type: Boolean, default: false },
    leaveChannelId: { type: String, default: null },
    leaveMessage:   { type: String, default: '👋 **{username}** has left the server. We now have {memberCount} members.' },

    rulesChannelId: { type: String, default: null },
    rulesText:      { type: String, default: '' },
  },
  { timestamps: true }
);

export const GuildModel: Model<IGuild> = mongoose.model<IGuild>('Guild', GuildSchema);
