import { BaseLogger } from './BaseLogger'
import { LogLevel } from './Logger'

export class ConsoleLogger extends BaseLogger {
  // Map our log levels to console levels
  private consoleLogMap = {
    [LogLevel.test]: 'log',
    [LogLevel.trace]: 'log',
    [LogLevel.debug]: 'debug',
    [LogLevel.info]: 'info',
    [LogLevel.warn]: 'warn',
    [LogLevel.error]: 'error',
    [LogLevel.fatal]: 'error',
  } as const

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private log(level: Exclude<LogLevel, LogLevel.off>, _message: string, data?: Record<string, any>): void {
    // Get console method from mapping
    const _consoleLevel = this.consoleLogMap[level]

    // Get logger prefix from log level names in enum
    const _prefix = LogLevel[level].toUpperCase()

    // Return early if logging is not enabled for this level
    if (!this.isEnabled(level)) return

    // Log, with or without data
    if (data) {
    } else {
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public test(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.test, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public trace(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.trace, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.debug, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.info, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.warn, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public error(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.error, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public fatal(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.fatal, message, data)
  }
}
