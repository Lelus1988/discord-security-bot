import { Router, Request, Response } from 'express';
import { ChannelType } from 'discord.js';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild } from '../utils/guildAccess';
import { ChannelInfo } from '../../src/types';

const router = Router();

function mapType(type: ChannelType): ChannelInfo['type'] {
  switch (type) {
    case ChannelType.GuildText:        return 'text';
    case ChannelType.GuildCategory:    return 'category';
    case ChannelType.GuildVoice:       return 'voice';
    case ChannelType.GuildAnnouncement: return 'announcement';
    default: return 'other';
  }
}

/** GET /api/channels/:guildId – all channels, for dropdown selectors. */
router.get('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const channels = await guild.channels.fetch();
  const result: ChannelInfo[] = [...channels.values()]
    .filter(c => c !== null)
    .map(c => ({
      id: c!.id,
      name: 'name' in c! ? c!.name : 'unknown',
      type: mapType(c!.type),
      parentId: 'parentId' in c! ? c!.parentId : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json(result);
});

export default router;
