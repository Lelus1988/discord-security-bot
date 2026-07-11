import { Router, Request, Response } from 'express';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild } from '../utils/guildAccess';
import { RoleService } from '../../src/services/RoleService';

const router = Router();

/** GET /api/roles/:guildId */
router.get('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  try {
    res.json(await RoleService.listRoles(guild));
  } catch (err) {
    res.status(500).json({ error: `${err}` });
  }
});

/** POST /api/roles/:guildId – { name, color, hoist, mentionable } */
router.post('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const { name, color, hoist, mentionable } = req.body;
  if (!name || typeof name !== 'string') {
    return void res.status(400).json({ error: 'Role name is required.' });
  }

  try {
    const role = await RoleService.createRole(guild, { name, color, hoist, mentionable });
    res.json({ success: true, role: { id: role.id, name: role.name } });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** PATCH /api/roles/:guildId/:roleId – { name?, color?, hoist?, mentionable? } */
router.patch('/:guildId/:roleId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  try {
    await RoleService.updateRole(guild, req.params.roleId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** DELETE /api/roles/:guildId/:roleId */
router.delete('/:guildId/:roleId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  try {
    await RoleService.deleteRole(guild, req.params.roleId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

export default router;
