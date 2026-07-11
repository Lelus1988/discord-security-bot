import { Router, Request, Response } from 'express';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild } from '../utils/guildAccess';
import { GuildService } from '../../src/services/GuildService';
import { MemberService } from '../../src/services/MemberService';
import { isClientReady, getClient } from '../../src/client';

const router = Router();

const MANAGE_GUILD_PERM = BigInt(0x20);

/** GET /api/guilds – guilds the user can manage, with live whitelist + bot-presence status. */
router.get('/', requireAuthApi, async (req: Request, res: Response) => {
  try {
    const userGuilds = req.session.guilds ?? [];

    const adminGuilds = userGuilds.filter(g => {
      const perms = BigInt(g.permissions);
      return g.owner || (perms & MANAGE_GUILD_PERM) !== 0n;
    });

    const client = isClientReady() ? getClient() : null;

    const enriched = adminGuilds.map(g => {
      const liveGuild = client?.guilds.cache.get(g.id);
      return {
        id:            g.id,
        name:          g.name,
        icon:          g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
        isWhitelisted: GuildService.isAllowed(g.id),
        botActive:     !!liveGuild,
        memberCount:   liveGuild?.memberCount ?? null,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

/** GET /api/guilds/:guildId/settings – raw stored settings document. */
router.get('/:guildId/settings', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  try {
    const settings = await GuildService.getSettings(guild.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/** GET /api/guilds/:guildId/stats – live overview stats (members, online, roles, channels…). */
router.get('/:guildId/stats', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  try {
    const stats = await MemberService.getStats(guild);
    res.json({ ...stats, name: guild.name, isWhitelisted: GuildService.isAllowed(guild.id) });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch stats: ${err}` });
  }
});

export default router;
