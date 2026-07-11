import { Router, Request, Response } from 'express';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild } from '../utils/guildAccess';
import { LogModel } from '../../src/database/models/Log';

const router = Router();

/** GET /api/logs/:guildId?type=MOD&limit=50 */
router.get('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10) || 50, 200);
  const type  = req.query.type as string | undefined;

  const filter: Record<string, unknown> = { guildId: guild.id };
  if (type && type !== 'ALL') filter.type = type;

  try {
    const logs = await LogModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: `${err}` });
  }
});

export default router;
