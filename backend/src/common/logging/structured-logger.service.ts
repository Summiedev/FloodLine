import { Injectable, LoggerService } from '@nestjs/common';

type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  context?: string;
  message: unknown;
  trace?: string;
  metadata?: unknown;
}

const SENSITIVE_KEY =
  /(password|passwd|token|authorization|cookie|secret|otp|verification|api.?key|storage.?key|device.?token|refresh)/i;

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly service = 'floodline-api';
  private readonly minimumLevel: LogLevel;
  private readonly levels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    log: 2,
    debug: 3,
    verbose: 4,
  };

  constructor() {
    const configuredLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    this.minimumLevel = configuredLevel && configuredLevel in this.levels ? configuredLevel : 'log';
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    if (this.levels[level] > this.levels[this.minimumLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      ...(context ? { context } : {}),
      message: this.sanitize(this.normalizeMessage(message)),
      ...(trace ? { trace: this.redactString(trace) } : {}),
    };

    const serialized = JSON.stringify(entry);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  private normalizeMessage(message: unknown): unknown {
    if (message instanceof Error) {
      return { name: message.name, message: message.message, stack: message.stack };
    }

    return message;
  }

  private sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (depth > 6) return '[redacted-depth]';
    if (typeof value === 'string') return this.redactString(value);
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item, depth + 1, seen));
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : this.sanitize(item, depth + 1, seen),
      ]),
    );
  }

  private redactString(value: string): string {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(
        /((?:access|refresh|id)[_-]?token|otp|code|secret|password)\s*[=:]\s*[^\s,;]+/gi,
        '$1=[REDACTED]',
      );
  }
}
