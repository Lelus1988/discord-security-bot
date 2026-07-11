import { ChatInputCommandInteraction, GuildMember, PermissionResolvable } from 'discord.js';
import { config } from '../config';
import { GuildService } from '../services/GuildService';

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/** Verify that the interaction comes from an allowed guild. */
export function checkWhitelist(interaction: ChatInputCommandInteraction): void {
  if (!interaction.guildId || !GuildService.isAllowed(interaction.guildId)) {
    throw new PermissionError('This server is not authorized to use this bot.');
  }
}

/** Verify that the user is the bot owner. */
export function checkOwner(interaction: ChatInputCommandInteraction): void {
  if (interaction.user.id !== config.ownerId) {
    throw new PermissionError('Only the bot owner can use this command.');
  }
}

/** Verify that the member has the specified Discord permission(s). */
export function checkPermissions(
  member: GuildMember,
  permissions: PermissionResolvable[]
): void {
  for (const perm of permissions) {
    if (!member.permissions.has(perm)) {
      throw new PermissionError(`You are missing the required permission: **${String(perm)}**`);
    }
  }
}

/**
 * Full guard for a command:
 * 1. Guild must be whitelisted
 * 2. Command must not be disabled
 * 3. Optionally: owner-only
 * 4. Optionally: required permissions
 */
export async function guardCommand(
  interaction: ChatInputCommandInteraction,
  options: {
    ownerOnly?: boolean;
    requiredPermissions?: PermissionResolvable[];
  } = {}
): Promise<void> {
  checkWhitelist(interaction);

  // Check if command is disabled in this guild
  if (interaction.guildId) {
    const disabled = await GuildService.isCommandDisabled(interaction.guildId, interaction.commandName);
    if (disabled) {
      throw new PermissionError(`The command \`/${interaction.commandName}\` is disabled on this server.`);
    }
  }

  if (options.ownerOnly) checkOwner(interaction);

  if (options.requiredPermissions && interaction.member instanceof GuildMember) {
    checkPermissions(interaction.member, options.requiredPermissions);
  }
}

/** Send an error reply (ephemeral). Works whether or not already replied. */
export async function replyError(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  const payload = { content: `❌ ${message}`, ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}
