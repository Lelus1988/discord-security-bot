import { Router, Request, Response } from 'express';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild } from '../utils/guildAccess';
import { GuildService } from '../../src/services/GuildService';
import { WelcomeService } from '../../src/services/WelcomeService';

const router = Router();

/** GET /api/welcome/:guildId */
router.get('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const settings = await GuildService.getSettings(guild.id);
  res.json({
    welcomeEnabled:   settings.welcomeEnabled,
    welcomeChannelId: settings.welcomeChannelId,
    welcomeMessage:   settings.welcomeMessage,
    welcomeUseEmbed:  settings.welcomeUseEmbed,
    leaveEnabled:     settings.leaveEnabled,
    leaveChannelId:   settings.leaveChannelId,
    leaveMessage:     settings.leaveMessage,
  });
});

/** PUT /api/welcome/:guildId */
router.put('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const {
    welcomeEnabled, welcomeChannelId, welcomeMessage, welcomeUseEmbed,
    leaveEnabled, leaveChannelId, leaveMessage,
  } = req.body;

  try {
    await GuildService.updateSettings(guild.id, {
      welcomeEnabled, welcomeChannelId, welcomeMessage, welcomeUseEmbed,
      leaveEnabled, leaveChannelId, leaveMessage,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** POST /api/welcome/:guildId/preview – { template } → rendered text */
router.post('/:guildId/preview', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const { template } = req.body;
  const username = req.session.user?.username ?? 'ExampleUser';
  const rendered = WelcomeService.preview(template || '', username, guild.name, guild.memberCount);
  res.json({ rendered });
});

export default router;
