import { readdirSync } from 'fs';
import { join } from 'path';
import { ExtendedClient, BotEvent } from '../types';
import { logger } from '../utils/logger';

/** Load all event handlers from src/events/*.ts */
export function loadEvents(client: ExtendedClient): void {
  const eventsPath = join(__dirname, '..', 'events');
  const files = readdirSync(eventsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of files) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require(join(eventsPath, file));
      const event: BotEvent = module.default ?? module;

      if (!event?.name) {
        logger.warn(`Event file ${file} has no .name – skipping`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      logger.debug(`Registered event: ${event.name}${event.once ? ' (once)' : ''}`);
    } catch (err) {
      logger.error(`Failed to load event ${file}: ${err}`);
    }
  }

  logger.info(`Loaded ${files.length} events`);
}
