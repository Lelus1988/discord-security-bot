import { EmbedBuilder, ChatInputCommandInteraction, ColorResolvable } from 'discord.js';

const DEV_COLOR: ColorResolvable = 0x5865f2;
const DEV_FOOTER_TEXT = '🛠️ Developer Mode';

export function createDevEmbed(
  interaction: ChatInputCommandInteraction,
  options: { title?: string; color?: ColorResolvable } = {}
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(options.color ?? DEV_COLOR)
    .setTitle(options.title ?? null)
    .setFooter({
      text: DEV_FOOTER_TEXT,
      iconURL: interaction.client.user?.displayAvatarURL(),
    })
    .setTimestamp();
}
