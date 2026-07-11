import { Router, Request, Response } from 'express';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild } from '../utils/guildAccess';
import { CustomCommandService } from '../../src/services/CustomCommandService';
import { GuildService } from '../../src/services/GuildService';

const router = Router();

/** GET /api/commands/:guildId – list custom commands + current prefix */
router.get('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const [commands, settings] = await Promise.all([
    CustomCommandService.list(guild.id),
    GuildService.getSettings(guild.id),
  ]);

  res.json({
    prefix: settings.prefix,
    commands: commands.map(c => ({
      id: c._id,
      trigger: c.trigger,
      response: c.response,
      useEmbed: c.useEmbed,
      embedColor: c.embedColor,
      enabled: c.enabled,
      uses: c.uses,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
    })),
  });
});

/** PUT /api/commands/:guildId/prefix – { prefix } */
router.put('/:guildId/prefix', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const prefix = (req.body.prefix || '').trim();
  if (!prefix || prefix.length > 5) {
    return void res.status(400).json({ error: 'Prefix must be 1–5 characters.' });
  }

  await GuildService.updateSettings(guild.id, { prefix });
  res.json({ success: true });
});

/** POST /api/commands/:guildId – { trigger, response, useEmbed?, embedColor? } */
router.post('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const { trigger, response, useEmbed, embedColor } = req.body;
  if (!trigger || !response) {
    return void res.status(400).json({ error: 'Trigger and response are required.' });
  }

  try {
    const command = await CustomCommandService.create(
      guild.id, trigger, response, req.session.user!.id, { useEmbed, embedColor }
    );
    res.json({ success: true, id: command._id });
  } catch (err) {
    res.status(400).json({ error: `${err instanceof Error ? err.message : err}` });
  }
});

/** PATCH /api/commands/:guildId/:id – { response?, useEmbed?, embedColor?, enabled? } */
router.patch('/:guildId/:id', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  try {
    const updated = await CustomCommandService.update(guild.id, req.params.id, req.body);
    if (!updated) return void res.status(404).json({ error: 'Command not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** DELETE /api/commands/:guildId/:id */
router.delete('/:guildId/:id', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const deleted = await CustomCommandService.delete(guild.id, req.params.id);
  if (!deleted) return void res.status(404).json({ error: 'Command not found.' });
  res.json({ success: true });
});

export default router;
