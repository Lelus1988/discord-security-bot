import { Router, Request, Response } from 'express';
import { requireAuthApi } from '../middleware/authMiddleware';
import { config } from '../../src/config';

const router = Router();

/** GET /api/me – current logged-in user, plus whether they are the bot owner. */
router.get('/', requireAuthApi, (req: Request, res: Response) => {
  res.json({
    ...req.session.user,
    isBotOwner: req.session.user?.id === config.ownerId,
  });
});

export default router;
