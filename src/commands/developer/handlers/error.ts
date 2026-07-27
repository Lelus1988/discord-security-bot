import { ChatInputCommandInteraction } from 'discord.js';
import { createDevEmbed } from '../../../utils/devEmbed';
import { DeveloperService } from '../../../services/DeveloperService';

export async function handleError(interaction: ChatInputCommandInteraction): Promise<void> {
  const errors = DeveloperService.getErrors(10);

  if (errors.length === 0) {
    const embed = createDevEmbed(interaction, { title: '✅ Keine kritischen Fehler' }).setDescription(
      'Es wurden bisher keine kritischen Fehler protokolliert (seit dem letzten Neustart).'
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = createDevEmbed(interaction, { title: `🚨 Kritische Fehler (letzte ${errors.length})`, color: 0xed4245 });

  for (const err of errors.slice(0, 10)) {
    const timestamp = `<t:${Math.floor(err.timestamp / 1000)}:R>`;
    const message = err.message.length > 500 ? `${err.message.slice(0, 500)}...` : err.message;
    embed.addFields({
      name: `${err.area} — ${timestamp}`,
      value: `\`\`\`${message}\`\`\``,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
