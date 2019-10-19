import { DisposableI } from './disposable';

/**
 * Log level definition
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';
export const LogLevelDebug: LogLevel = 'debug';
export const LogLevelInfo: LogLevel = 'info';
export const LogLevelWarning: LogLevel = 'warning';
export const LogLevelError: LogLevel = 'error';

/**
 * Interface for default loggers
 */
export interface LoggerI extends DisposableI {
  readonly enabled: boolean;
  dispose(): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Default logger writing messages to the console
 */
class DefaultLogger implements LoggerI {
  public readonly enabled: boolean = true;

  public dispose(): void {}

  public debug(message: string): void {
    console.log(`DEBUG: ${message}`);
  }
  public info(message: string): void {
    console.log(`INFO: ${message}`);
  }

  public warn(message: string): void {
    console.log(`WARNING: ${message}`);
  }

  public error(message: string): void {
    console.log(`ERROR: ${message}`);
  }
}

/**
 * Logger class that has a `level` property to define which messages should be logged.
 * Only messages with the same or a higher level will be logged.
 *
 * It exists a singleton `instance` that can be used from everywhere. Its core logger can be set with `setCoreLogger`.
 */
export class SelectiveLogger implements LoggerI {
  public static instance = new SelectiveLogger();

  public constructor(private core: LoggerI = new DefaultLogger(), public level: LogLevel = LogLevelWarning) {}

  public setCoreLogger(core: LoggerI) {
    this.core = core;
  }

  public get enabled() {
    return this.core.enabled;
  }

  public debug(message: string) {
    if (this.enabled && this.level == LogLevelDebug) this.core.debug(message);
  }

  public info(message: string) {
    if ((this.enabled && this.level == LogLevelDebug) || this.level == LogLevelInfo) this.core.info(message);
  }

  public warn(message: string) {
    if (this.enabled && this.level != LogLevelError) this.core.warn(message);
  }

  public error(message: string) {
    if (this.enabled) this.core.error(message);
  }

  public dispose() {
    this.core.dispose();
  }
}

export function log(message: string, logger: LoggerI, level: LogLevel = LogLevelDebug) {
  switch (level) {
    case LogLevelDebug: {
      logger.debug(message);
      break;
    }
    case LogLevelInfo: {
      logger.info(message);
      break;
    }
    case LogLevelWarning: {
      logger.warn(message);
      break;
    }
    case LogLevelError: {
      logger.error(message);
      break;
    }
  }
}
