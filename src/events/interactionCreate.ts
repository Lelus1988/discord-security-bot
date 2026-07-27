import {
  Interaction, ChatInputCommandInteraction,
  ButtonInteraction, ModalSubmitInteraction, TextChannel, GuildMember
} from 'discord.js';
import { BotEvent, ExtendedClient } from '../types';
import { GuildService } from '../services/GuildService';
import { TicketService } from '../services/TicketService';
import { PermissionError, replyError } from '../middleware/permissions';
import { logger } from '../utils/logger';
import { reportError, extractCommandOptions } from '../utils/errorReporter';

const event: BotEvent = {
  name: 'interactionCreate',

  async execute(interaction: Interaction, client: ExtendedClient): Promise<void> {

    // ── Slash Commands ────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction as ChatInputCommandInteraction, client);
      return;
    }

    // ── Button Interactions ───────────────────────────────────────────────
    if (interaction.isButton()) {
      await handleButton(interaction as ButtonInteraction);
      return;
    }

    // ── Modal Submissions ──────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      await handleModal(interaction as ModalSubmitInteraction);
      return;
    }
  },
};

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient
): Promise<void> {
  // Basic guild check before even finding the command
  if (interaction.guildId && !GuildService.isAllowed(interaction.guildId)) {
    await replyError(interaction, 'This server is not authorized to use this bot.');
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    await replyError(interaction, `Unknown command: \`/${interaction.commandName}\``);
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (err) {
    if (err instanceof PermissionError) {
      await replyError(interaction, err.message);
    } else {
      // Sammle Fehlerinformationen
      const errorContext = {
        userId: interaction.user.id,
        username: interaction.user.tag,
        commandName: interaction.commandName,
        subcommand: interaction.options.getSubcommand(false) ?? '(keine)',
        options: extractCommandOptions(interaction),
        guildId: interaction.guildId,
      };

      // Sende detaillierte Fehlermeldung
      await reportError(interaction, err, errorContext);
    }
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const [action, subAction] = interaction.customId.split(':');

  if (action === 'ticket') {
    if (subAction === 'close') {
      if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
      await interaction.deferReply({ ephemeral: true });

      try {
        await TicketService.closeTicket(
          interaction.channel as TextChannel,
          interaction.member
        );
        await interaction.editReply({ content: '🔒 Ticket is being closed…' });
      } catch (err) {
        await interaction.editReply({ content: `❌ ${err}` });
      }
    }
  }
}

// Zentrale Verwaltung für zukünftige, globale Modals (falls benötigt)
async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  // Da "say"-Modal direkt im Command via awaitModalSubmit() abgefangen wird,
  // müssen wir hier aktuell nichts tun. Die Funktion blockiert aber, dass Fehlermeldungen
  // auftreten und steht für zukünftige globale Modals bereit.
  
  // Beispiel für zukünftige Modals:
  // const [action] = interaction.customId.split('-');
  // if (action === 'meinAnderesModal') { ... }
}

export default event;