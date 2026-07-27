import { ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from 'discord.js';
import { createDevEmbed } from '../../../utils/devEmbed';

function parseColor(input: string | null): ColorResolvable | undefined {
  if (!input) return undefined;
  const hex = input.startsWith('#') ? input.slice(1) : input;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return parseInt(hex, 16) as ColorResolvable;
  }
  return undefined;
}

export async function handleEmbedTest(
  interaction: ChatInputCommandInteraction,
  options: {
    title: string | null;
    description: string | null;
    color: string | null;
    footer: string | null;
    thumbnail: string | null;
    image: string | null;
    fields: string | null; // Format: "Name1|Value1;Name2|Value2"
  }
): Promise<void> {
  const color = parseColor(options.color);

  // Basis-Embed inkl. Developer-Footer, damit klar ist, dass es ein Test-Embed ist.
  const embed = createDevEmbed(interaction, {
    title: options.title ?? 'Test Embed',
    color: color ?? 0x5865f2,
  });

  if (options.description) embed.setDescription(options.description);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);

  // Eigener Footer überschreibt den Standard-Developer-Footer-Text, behält
  // aber das Icon, damit erkennbar bleibt, dass es ein Developer-Test ist.
  if (options.footer) {
    embed.setFooter({
      text: `${options.footer} • 🛠️ Developer Mode`,
      iconURL: interaction.client.user?.displayAvatarURL(),
    });
  }

  if (options.fields) {
    const fieldPairs = options.fields
      .split(';')
      .map(pair => pair.split('|'))
      .filter(([name, value]) => name && value)
      .slice(0, 25); // Discord-Limit

    if (fieldPairs.length) {
      embed.addFields(fieldPairs.map(([name, value]) => ({ name: name.trim(), value: value.trim() })));
    }
  }

  await interaction.editReply({
    content: '**Vorschau des Test-Embeds:**',
    embeds: [embed as EmbedBuilder],
  });
}
