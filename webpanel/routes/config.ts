import { Router, Request, Response } from 'express';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild } from '../utils/guildAccess';
import { GuildService } from '../../src/services/GuildService';
import { config as botConfig } from '../../src/config';

const router = Router();

/** PUT /api/config/:guildId – update general protection/channel settings for a guild. */
router.put('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const {
    antiRaidEnabled, antiSpamEnabled,
    logChannelId, modRoleId, ticketCategoryId,
    joinThreshold, windowSec,
  } = req.body;

  try {
    await GuildService.updateSettings(guild.id, {
      antiRaidEnabled, antiSpamEnabled,
      logChannelId, modRoleId, ticketCategoryId,
      joinThreshold, windowSec,
    });
    res.json({ success: true, message: 'Settings updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * POST /api/config/:guildId/whitelist
 * Bot-owner only: add/remove a guild from the whitelist.
 */
router.post('/:guildId/whitelist', requireAuthApi, async (req: Request, res: Response) => {
  const userId = req.session.user?.id;
  if (userId !== botConfig.ownerId) {
    res.status(403).json({ error: 'Only the bot owner can manage the whitelist.' });
    return;
  }

  const { guildId } = req.params;
  const { action } = req.body; // 'add' | 'remove'

  if (action === 'add') {
    GuildService.addToWhitelist(guildId);
    res.json({ success: true, message: `Guild ${guildId} added to whitelist.` });
  } else if (action === 'remove') {
    GuildService.removeFromWhitelist(guildId);
    res.json({ success: true, message: `Guild ${guildId} removed from whitelist.` });
  } else {
    res.status(400).json({ error: 'Invalid action. Use "add" or "remove".' });
  }
});

export default router;
