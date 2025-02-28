import type { Logger } from './Logger'

import { LogLevel } from './Logger'

export abstract class BaseLogger implements Logger {
  public logLevel: LogLevel

  public constructor(logLevel: LogLevel = LogLevel.off) {
    this.logLevel = logLevel
  }

  public isEnabled(logLevel: LogLevel) {
    return logLevel >= this.logLevel
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public abstract test(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public abstract trace(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public abstract debug(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public abstract info(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public abstract warn(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public abstract error(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public abstract fatal(message: string, data?: Record<string, any>): void
}
