import { Router, Request, Response } from 'express';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild, getActingMember } from '../utils/guildAccess';
import { MemberService } from '../../src/services/MemberService';
import { ModerationService } from '../../src/services/ModerationService';
import { parseDuration } from '../../src/utils/helpers';

const router = Router();

/** GET /api/members/:guildId – live member list with presence + roles. Add ?fresh=true to bypass cache. */
router.get('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  try {
    const force = req.query.fresh === 'true';
    const members = await MemberService.listMembers(guild, force);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch members: ${err}` });
  }
});

/** POST /api/members/:guildId/:userId/kick – { reason } */
router.post('/:guildId/:userId/kick', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const actingMember = await getActingMember(req, guild);
  if (!actingMember) return void res.status(403).json({ error: 'Could not verify your membership in this server.' });

  try {
    const target = await guild.members.fetch(req.params.userId);
    await ModerationService.kick(guild, target, actingMember, req.body.reason || 'No reason provided (via dashboard)');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** POST /api/members/:guildId/:userId/ban – { reason } */
router.post('/:guildId/:userId/ban', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const actingMember = await getActingMember(req, guild);
  if (!actingMember) return void res.status(403).json({ error: 'Could not verify your membership in this server.' });

  try {
    const target = await guild.members.fetch(req.params.userId).catch(() => null);
    await ModerationService.ban(guild, target ?? { id: req.params.userId } as any, actingMember, req.body.reason || 'No reason provided (via dashboard)');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** POST /api/members/:guildId/:userId/mute – { duration: "10m", reason } */
router.post('/:guildId/:userId/mute', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const actingMember = await getActingMember(req, guild);
  if (!actingMember) return void res.status(403).json({ error: 'Could not verify your membership in this server.' });

  const durationMs = parseDuration(req.body.duration || '10m');
  if (!durationMs) return void res.status(400).json({ error: 'Invalid duration format. Use e.g. 10m, 1h, 1d.' });

  try {
    const target = await guild.members.fetch(req.params.userId);
    await ModerationService.mute(guild, target, actingMember, durationMs, req.body.reason || 'No reason provided (via dashboard)');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** POST /api/members/:guildId/:userId/unmute */
router.post('/:guildId/:userId/unmute', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const actingMember = await getActingMember(req, guild);
  if (!actingMember) return void res.status(403).json({ error: 'Could not verify your membership in this server.' });

  try {
    const target = await guild.members.fetch(req.params.userId);
    await ModerationService.unmute(guild, target, actingMember, 'Unmuted via dashboard');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** POST /api/members/:guildId/:userId/roles – { roleId, action: 'add'|'remove' } */
router.post('/:guildId/:userId/roles', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const { roleId, action } = req.body;
  if (!roleId || !['add', 'remove'].includes(action)) {
    return void res.status(400).json({ error: 'roleId and action ("add"|"remove") are required.' });
  }

  try {
    const member = await guild.members.fetch(req.params.userId);
    if (action === 'add') {
      await member.roles.add(roleId, 'Assigned via web dashboard');
    } else {
      await member.roles.remove(roleId, 'Removed via web dashboard');
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

export default router;
