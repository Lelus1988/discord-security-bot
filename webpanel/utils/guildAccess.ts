import { Request, Response } from 'express';
import { Guild, GuildMember } from 'discord.js';
import { getClient } from '../../src/client';

const MANAGE_GUILD_PERM = BigInt(0x20);

/**
 * Verify that:
 * 1. The session user manages this guild on Discord (owner or Manage Guild permission)
 * 2. The bot is actually live in this guild right now
 *
 * On success returns the live discord.js Guild object.
 * On failure, sends an appropriate error response and returns null.
 */
export async function getAuthorizedGuild(req: Request, res: Response, guildId: string): Promise<Guild | null> {
  const userGuilds = req.session.guilds ?? [];
  const sessionGuild = userGuilds.find(g => g.id === guildId);

  if (!sessionGuild) {
    res.status(403).json({ error: 'You do not have access to this server.' });
    return null;
  }

  const perms = BigInt(sessionGuild.permissions);
  const canManage = sessionGuild.owner || (perms & MANAGE_GUILD_PERM) !== 0n;
  if (!canManage) {
    res.status(403).json({ error: 'You need "Manage Server" permission on Discord to do this.' });
    return null;
  }

  let client;
  try {
    client = getClient();
  } catch {
    res.status(503).json({ error: 'Bot is still starting up. Please try again in a moment.' });
    return null;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    res.status(404).json({ error: 'The bot is not currently active in this server.' });
    return null;
  }

  return guild;
}

/** Fetch the acting panel user as a live GuildMember, for permission/hierarchy checks. */
export async function getActingMember(req: Request, guild: Guild): Promise<GuildMember | null> {
  const userId = req.session.user?.id;
  if (!userId) return null;
  try {
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}
