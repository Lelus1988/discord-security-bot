import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { config } from './config';
import { connectDatabase } from './database/connection';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { logger } from './utils/logger';
import { ExtendedClient } from './types';
import { setClient } from './client';
import { startWebPanel } from '../webpanel/server';
import { initTicketSystem } from './commands/tickets/ticket';

// ── Create client with all required intents ───────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // member list (privileged – enable in Dev Portal)
    GatewayIntentBits.GuildPresences,    // online/idle/dnd status (privileged – enable in Dev Portal)
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,    // privileged – enable in Dev Portal
  ],
  partials: [
    Partials.GuildMember,
    Partials.Message,
    Partials.Channel,
  ],
}) as ExtendedClient;

client.commands = new Collection();

// ── Graceful shutdown ─────────────────────────────────────────────────────
process.on('SIGINT',  () => { logger.info('Shutting down (SIGINT)…');  client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { logger.info('Shutting down (SIGTERM)…'); client.destroy(); process.exit(0); });

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason}`);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info('Starting Private Security Bot…');

  await connectDatabase();
  await loadCommands(client);
  loadEvents(client);

  await client.login(config.token);

  client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag}`);

    setClient(client);
    initTicketSystem(client);

    await startWebPanel();
  });
}

main().catch(err => {
  logger.error(`Fatal error during startup: ${err}`);
  process.exit(1);
});