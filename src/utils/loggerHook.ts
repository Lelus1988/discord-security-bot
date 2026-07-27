import { logger } from './logger';
import { DeveloperService } from '../services/DeveloperService';
export function attachDeveloperLogHook(): void {
  const originalInfo = logger.info.bind(logger);
  const originalWarn = logger.warn.bind(logger);
  const originalError = logger.error.bind(logger);
  const originalDebug = logger.debug.bind(logger);

  logger.info = ((message: string) => {
    DeveloperService.recordLog('INFO', message);
    originalInfo(message);
  }) as typeof logger.info;

  logger.warn = ((message: string) => {
    DeveloperService.recordLog('WARN', message);
    originalWarn(message);
  }) as typeof logger.warn;

  logger.error = ((message: string) => {
    DeveloperService.recordLog('ERROR', message);
    DeveloperService.recordError({ message, area: 'general' });
    originalError(message);
  }) as typeof logger.error;

  logger.debug = ((message: string) => {
    DeveloperService.recordLog('DEBUG', message);
    originalDebug(message);
  }) as typeof logger.debug;
}
