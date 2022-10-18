import type { EnrichedLogMessage, LogData, Logger } from './Logger'

import { LogLevel } from './Logger'

export abstract class BaseLogger implements Logger {
  public constructor(public logLevel: LogLevel = LogLevel.off, public context?: string) {}

  public isEnabled(logLevel: LogLevel) {
    return logLevel >= this.logLevel
  }

  protected getEnrichedMessage(data?: LogData): EnrichedLogMessage {
    const message: EnrichedLogMessage = {
      ...data,
    }
    if (this.context) message.context = this.context
    return message
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  public abstract test(message: string, data?: LogData): void
  public abstract trace(message: string, data?: LogData): void
  public abstract debug(message: string, data?: LogData): void
  public abstract info(message: string, data?: LogData): void
  public abstract warn(message: string, data?: LogData): void
  public abstract error(message: string, data?: LogData): void
  public abstract fatal(message: string, data?: LogData): void

  public abstract createContextLogger(context: string): Logger
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
