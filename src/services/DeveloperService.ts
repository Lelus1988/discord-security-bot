import { CommandUsageEntry, ErrorLogEntry, LogEntry, LogLevel } from '../types/developer';

const MAX_ERROR_ENTRIES = 100;
const MAX_LOG_ENTRIES = 500;

export class DeveloperService {
  private static commandUsage: CommandUsageEntry[] = [];
  private static errors: ErrorLogEntry[] = [];
  private static logs: LogEntry[] = [];
  private static readonly startedAt: number = Date.now();

  static getStartedAt(): number {
    return this.startedAt;
  }


  static recordCommandUsage(entry: CommandUsageEntry): void {
    this.commandUsage.push(entry);
  }

  static getCommandUsage(): CommandUsageEntry[] {
    return this.commandUsage;
  }

  static getUsageSummary(): {
    totalExecutions: number;
    perCommand: Map<string, number>;
    perUser: Map<string, { username: string; count: number }>;
    perUserPerCommand: Map<string, Map<string, number>>;
    mostUsedCommand: string | null;
    topUser: { userId: string; username: string; count: number } | null;
  } {
    const perCommand = new Map<string, number>();
    const perUser = new Map<string, { username: string; count: number }>();
    const perUserPerCommand = new Map<string, Map<string, number>>();

    for (const entry of this.commandUsage) {
      perCommand.set(entry.commandName, (perCommand.get(entry.commandName) ?? 0) + 1);

      const userEntry = perUser.get(entry.userId) ?? { username: entry.username, count: 0 };
      userEntry.count += 1;
      userEntry.username = entry.username;
      perUser.set(entry.userId, userEntry);

      const userCommands = perUserPerCommand.get(entry.userId) ?? new Map<string, number>();
      userCommands.set(entry.commandName, (userCommands.get(entry.commandName) ?? 0) + 1);
      perUserPerCommand.set(entry.userId, userCommands);
    }

    let mostUsedCommand: string | null = null;
    let mostUsedCount = -1;
    for (const [name, count] of perCommand) {
      if (count > mostUsedCount) {
        mostUsedCommand = name;
        mostUsedCount = count;
      }
    }

    let topUser: { userId: string; username: string; count: number } | null = null;
    let topUserCount = -1;
    for (const [userId, data] of perUser) {
      if (data.count > topUserCount) {
        topUser = { userId, username: data.username, count: data.count };
        topUserCount = data.count;
      }
    }

    return {
      totalExecutions: this.commandUsage.length,
      perCommand,
      perUser,
      perUserPerCommand,
      mostUsedCommand,
      topUser,
    };
  }


  static recordError(error: Omit<ErrorLogEntry, 'timestamp'>): void {
    this.errors.push({ ...error, timestamp: Date.now() });
    if (this.errors.length > MAX_ERROR_ENTRIES) {
      this.errors.shift();
    }
  }

  static getErrors(limit = 10): ErrorLogEntry[] {
    return this.errors.slice(-limit).reverse();
  }

  static clearErrors(): void {
    this.errors = [];
  }


  static recordLog(level: LogLevel, message: string): void {
    this.logs.push({ level, message, timestamp: Date.now() });
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs.shift();
    }
  }

  static getLogs(level?: LogLevel, limit = 20): LogEntry[] {
    const filtered = level ? this.logs.filter(l => l.level === level) : this.logs;
    return filtered.slice(-limit).reverse();
  }
}
