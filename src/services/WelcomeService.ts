import { GuildMember, PartialGuildMember, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { GuildModel } from '../database/models/Guild';
import { logger } from '../utils/logger';

/** Replace placeholders like {user}, {username}, {server}, {memberCount} in a template string. */
function renderTemplate(template: string, member: GuildMember | PartialGuildMember): string {
  const guild = member.guild;
  return template
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user?.username ?? 'Unknown User')
    .replaceAll('{tag}', member.user?.tag ?? 'Unknown#0000')
    .replaceAll('{server}', guild.name)
    .replaceAll('{memberCount}', String(guild.memberCount));
}

export class WelcomeService {

  /** Send the configured welcome message when a member joins. */
  static async sendWelcome(member: GuildMember): Promise<void> {
    try {
      const settings = await GuildModel.findOne({ guildId: member.guild.id });
      if (!settings?.welcomeEnabled || !settings.welcomeChannelId) return;

      const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const text = renderTemplate(settings.welcomeMessage, member);

      if (settings.welcomeUseEmbed) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setDescription(text)
          .setThumbnail(member.user.displayAvatarURL())
          .setFooter({ text: `Member #${member.guild.memberCount}` })
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send({ content: text });
      }
    } catch (err) {
      logger.error(`Failed to send welcome message in ${member.guild.id}: ${err}`);
    }
  }

  /** Send the configured leave message when a member leaves. */
  static async sendLeave(member: GuildMember | PartialGuildMember): Promise<void> {
    try {
      const settings = await GuildModel.findOne({ guildId: member.guild.id });
      if (!settings?.leaveEnabled || !settings.leaveChannelId) return;

      const channel = await member.guild.channels.fetch(settings.leaveChannelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const text = renderTemplate(settings.leaveMessage, member);

      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setDescription(text)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`Failed to send leave message in ${member.guild.id}: ${err}`);
    }
  }

  /** Preview-render a template without sending (used by the webpanel preview). */
  static preview(template: string, username: string, serverName: string, memberCount: number): string {
    return template
      .replaceAll('{user}', `@${username}`)
      .replaceAll('{username}', username)
      .replaceAll('{tag}', `${username}#0000`)
      .replaceAll('{server}', serverName)
      .replaceAll('{memberCount}', String(memberCount));
  }
}
