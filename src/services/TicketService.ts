import {
  Guild, GuildMember, TextChannel, CategoryChannel,
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, EmbedBuilder, Colors, ChannelType
} from 'discord.js';
import { GuildModel } from '../database/models/Guild';
import { LoggingService } from './LoggingService';
import { logger } from '../utils/logger';

// In-memory tracking: guildId → Set of open ticket channelIds
const openTickets = new Map<string, Set<string>>();

export class TicketService {

  /** Create a new ticket channel for a member. */
  static async createTicket(
    guild: Guild,
    member: GuildMember,
    reason: string
  ): Promise<TextChannel | null> {
    const settings = await GuildModel.findOne({ guildId: guild.id });
    if (!settings) return null;

    // Prevent duplicate tickets
    const userTickets = openTickets.get(guild.id);
    if (userTickets) {
      for (const channelId of userTickets) {
        const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
        if (channel && channel.topic?.includes(member.id)) {
          throw new Error(`You already have an open ticket: <#${channelId}>`);
        }
      }
    }

    // Find category
    let category: CategoryChannel | null = null;
    if (settings.ticketCategoryId) {
      category = guild.channels.cache.get(settings.ticketCategoryId) as CategoryChannel ?? null;
    }

    const ticketChannel = await guild.channels.create({
      name: `ticket-${member.user.username.toLowerCase().replace(/\W/g, '')}`,
      type: ChannelType.GuildText,
      parent: category ?? undefined,
      topic: `Ticket by ${member.user.tag} (${member.id}) | Reason: ${reason}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        ...(settings.modRoleId ? [{
          id: settings.modRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        }] : []),
      ],
    }) as TextChannel;

    // Track open ticket
    if (!openTickets.has(guild.id)) openTickets.set(guild.id, new Set());
    openTickets.get(guild.id)!.add(ticketChannel.id);

    // Post welcome embed with close button
    const embed = new EmbedBuilder()
      .setTitle('🎫 Support Ticket')
      .setColor(Colors.Blue)
      .setDescription(`Welcome <@${member.id}>!\nPlease describe your issue. Staff will assist you shortly.`)
      .addFields({ name: 'Reason', value: reason })
      .setTimestamp();

    const closeButton = new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

    await ticketChannel.send({
      content: `<@${member.id}>${settings.modRoleId ? ` | <@&${settings.modRoleId}>` : ''}`,
      embeds: [embed],
      components: [row],
    });

    await LoggingService.logAndSend(guild, 'INFO', 'Ticket Opened',
      `Ticket by ${member.user.tag}`,
      [
        { name: 'User',    value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: 'Channel', value: `<#${ticketChannel.id}>`,               inline: true },
        { name: 'Reason',  value: reason },
      ]
    );

    logger.info(`[TICKET] Created ticket ${ticketChannel.name} for ${member.user.tag}`);
    return ticketChannel;
  }

  /** Close a ticket channel – saves transcript then deletes. */
  static async closeTicket(
    channel: TextChannel,
    closer: GuildMember
  ): Promise<void> {
    const guild = channel.guild;
    const transcript = await this.buildTranscript(channel);

    // Find ticket opener from topic
    const ownerMatch = channel.topic?.match(/\((\d+)\)/);
    const ownerId = ownerMatch ? ownerMatch[1] : null;

    // Try to DM the transcript to the ticket opener
    if (ownerId) {
      try {
        const opener = await guild.members.fetch(ownerId);
        await opener.send({
          content: `Your ticket in **${guild.name}** has been closed.`,
          files: [{
            attachment: Buffer.from(transcript, 'utf8'),
            name: `transcript-${channel.name}.txt`,
          }],
        });
      } catch { /* DMs disabled */ }
    }

    // Remove from tracking
    openTickets.get(guild.id)?.delete(channel.id);

    await LoggingService.logAndSend(guild, 'INFO', 'Ticket Closed',
      `Closed by ${closer.user.tag}`,
      [
        { name: 'Channel', value: channel.name,                          inline: true },
        { name: 'Closed by', value: `<@${closer.id}> (${closer.user.tag})`, inline: true },
      ]
    );

    logger.info(`[TICKET] Ticket ${channel.name} closed by ${closer.user.tag}`);

    // Brief delay so the user sees the message, then delete
    setTimeout(async () => {
      try { await channel.delete('Ticket closed'); } catch { /* noop */ }
    }, 3000);
  }

  /** Build a plain-text transcript of a ticket channel. */
  private static async buildTranscript(channel: TextChannel): Promise<string> {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();

    const lines = sorted.map(m =>
      `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || '(no text)'}`
    );

    return `=== TICKET TRANSCRIPT: ${channel.name} ===\n${lines.join('\n')}\n=== END ===`;
  }
}
