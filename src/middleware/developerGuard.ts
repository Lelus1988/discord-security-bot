import { ChatInputCommandInteraction } from 'discord.js';
import { PermissionError } from './permissions';

export const DEVELOPER_ID = '1454112721174921343';

export function checkDeveloper(interaction: ChatInputCommandInteraction): void {
  if (interaction.user.id !== DEVELOPER_ID) {
    throw new PermissionError('Dieser Command ist ausschließlich dem Entwickler vorbehalten.');
  }
}

export async function guardDeveloperCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  checkDeveloper(interaction);
}
