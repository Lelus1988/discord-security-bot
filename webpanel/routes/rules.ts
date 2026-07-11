import { Router, Request, Response } from 'express';
import { EmbedBuilder, Colors, ChannelType } from 'discord.js';
import { requireAuthApi } from '../middleware/authMiddleware';
import { getAuthorizedGuild } from '../utils/guildAccess';
import { GuildService } from '../../src/services/GuildService';

const router = Router();

/** GET /api/rules/:guildId */
router.get('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const settings = await GuildService.getSettings(guild.id);
  res.json({
    rulesChannelId: settings.rulesChannelId,
    rulesText: settings.rulesText,
  });
});

/** PUT /api/rules/:guildId – { rulesChannelId, rulesText } */
router.put('/:guildId', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const { rulesChannelId, rulesText } = req.body;

  try {
    await GuildService.updateSettings(guild.id, { rulesChannelId, rulesText });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: `${err}` });
  }
});

/** POST /api/rules/:guildId/post – posts the rules embed in the configured channel */
router.post('/:guildId/post', requireAuthApi, async (req: Request, res: Response) => {
  const guild = await getAuthorizedGuild(req, res, req.params.guildId);
  if (!guild) return;

  const settings = await GuildService.getSettings(guild.id);

  if (!settings.rulesChannelId || !settings.rulesText?.trim()) {
    return void res.status(400).json({
      error: 'Bitte zuerst einen Regel-Kanal und einen Regeltext speichern.'
    });
  }

  try {
    const channel = await guild.channels.fetch(settings.rulesChannelId);

    if (!channel) {
      return void res.status(400).json({
        error: 'Der konfigurierte Regel-Kanal wurde nicht gefunden.'
      });
    }

    const allowedTypes = [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement
    ];

    if (!allowedTypes.includes(channel.type)) {
      return void res.status(400).json({
        error: 'Der Regel-Kanal muss ein Text- oder Ankündigungs-Kanal sein.'
      });
    }

    if (!channel.isTextBased() || !('send' in channel)) {
      return void res.status(400).json({
        error: 'In den ausgewählten Kanal kann keine Nachricht gesendet werden.'
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📜 Regeln — ${guild.name}`)
      .setDescription(settings.rulesText)
      .setColor(Colors.Blue)
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    res.json({ success: true });
  } catch (err) {
    console.error('Rules post error:', err);
    res.status(400).json({ error: `${err}` });
  }
});

export default router;