export interface CommandUsageEntry {
  commandName: string;
  userId: string;
  username: string;
  guildId: string | null;
  timestamp: number;
}

export interface ErrorLogEntry {
  message: string;
  stack?: string;
  area: string;
  timestamp: number;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
}
