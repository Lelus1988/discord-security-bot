import { ChatInputCommandInteraction } from 'discord.js';
import { PermissionError } from './permissions';

export const DEVELOPER_IDS = [
  '1454112721174921343',
  '1492573129560559617'
];

export function checkDeveloper(interaction: ChatInputCommandInteraction): void {
  if (!DEVELOPER_IDS.includes(interaction.user.id)) {
    throw new PermissionError('Dieser Command ist ausschließlich lelouch vi britannia (dem Entwickler) vorbehalten.');
  }
}

export async function guardDeveloperCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  checkDeveloper(interaction);
}