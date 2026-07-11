import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Collection } from 'discord.js';
import { ExtendedClient, BotCommand } from '../types';
import { logger } from '../utils/logger';

/** Recursively load all command files from src/commands/**\/*.ts */
export async function loadCommands(client: ExtendedClient): Promise<void> {
  const commands = new Collection<string, BotCommand>();
  const commandsPath = join(__dirname, '..', 'commands');

  function loadDir(dirPath: string): void {
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      if (statSync(fullPath).isDirectory()) {
        loadDir(fullPath);
      } else if (entry.endsWith('.ts') || entry.endsWith('.js')) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const module = require(fullPath);
          const command: BotCommand = module.default ?? module;
          if (!command?.data?.name) {
            logger.warn(`Command at ${fullPath} has no .data.name – skipping`);
            continue;
          }
          commands.set(command.data.name, command);
          logger.debug(`Loaded command: /${command.data.name}`);
        } catch (err) {
          logger.error(`Failed to load command at ${fullPath}: ${err}`);
        }
      }
    }
  }

  loadDir(commandsPath);
  client.commands = commands;
  logger.info(`Loaded ${commands.size} commands`);
}
