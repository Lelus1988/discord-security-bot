import { ExtendedClient } from './types';

let clientInstance: ExtendedClient | null = null;

/** Called once in index.ts after the bot has logged in. */
export function setClient(client: ExtendedClient): void {
  clientInstance = client;
}

/** Used by webpanel routes to access live guild/member/role data. */
export function getClient(): ExtendedClient {
  if (!clientInstance) {
    throw new Error('Discord client is not ready yet. Please wait a moment and try again.');
  }
  return clientInstance;
}

/** Non-throwing check, useful for health/status display. */
export function isClientReady(): boolean {
  return clientInstance !== null && clientInstance.isReady();
}
