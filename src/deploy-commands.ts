import { REST, Routes } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { config } from './config';
import { logger } from './utils/logger';

const commands: object[] = [];
const commandsPath = join(__dirname, 'commands');

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
        const command = module.default ?? module;
        if (command?.data?.toJSON) {
          commands.push(command.data.toJSON());
          logger.debug(`Queued: /${command.data.name}`);
        }
      } catch (err) {
        logger.error(`Failed to load ${fullPath}: ${err}`);
      }
    }
  }
}

loadDir(commandsPath);

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    logger.info(`Deploying ${commands.length} application (/) commands…`);

    // Deploy globally (takes up to 1 hour to propagate)
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );

    logger.info('✅ All commands deployed successfully!');
  } catch (err) {
    logger.error(`Deployment failed: ${err}`);
    process.exit(1);
  }
})();
