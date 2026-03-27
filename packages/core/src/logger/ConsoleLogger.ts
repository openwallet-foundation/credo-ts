import { BaseLogger } from './BaseLogger'
import { LogLevel } from './Logger'
import { replaceError } from './replaceError'

// biome-ignore lint/suspicious/noExplicitAny: no explanation
type LogData = Record<string, any>

export class ConsoleLogger extends BaseLogger {
  // Map our log levels to console levels
  private consoleLogMap = {
    [LogLevel.Test]: 'log',
    [LogLevel.Trace]: 'log',
    [LogLevel.Debug]: 'debug',
    [LogLevel.Info]: 'info',
    [LogLevel.Warn]: 'warn',
    [LogLevel.Error]: 'error',
    [LogLevel.Fatal]: 'error',
  } as const

  private log(level: Exclude<LogLevel, LogLevel.Off>, message: string, data?: LogData): void {
    // Get console method from mapping
    const consoleLevel = this.consoleLogMap[level]

    // Get logger prefix from log level names in enum
    const prefix = LogLevel[level].toUpperCase()

    // Return early if logging is not enabled for this level
    if (!this.isEnabled(level)) return

    // Log, with or without data
    if (data) {
      // biome-ignore lint/suspicious/noConsole: ConsoleLogger
      console[consoleLevel](`${prefix}: ${message}`, JSON.stringify(data, replaceError, 2))
    } else {
      // biome-ignore lint/suspicious/noConsole: ConsoleLogger
      console[consoleLevel](`${prefix}: ${message}`)
    }
  }

  public test(message: string, data?: LogData): void {
    this.log(LogLevel.Test, message, data)
  }

  public trace(message: string, data?: LogData): void {
    this.log(LogLevel.Trace, message, data)
  }

  public debug(message: string, data?: LogData): void {
    this.log(LogLevel.Debug, message, data)
  }

  public info(message: string, data?: LogData): void {
    this.log(LogLevel.Info, message, data)
  }

  public warn(message: string, data?: LogData): void {
    this.log(LogLevel.Warn, message, data)
  }

  public error(message: string, data?: LogData): void {
    this.log(LogLevel.Error, message, data)
  }

  public fatal(message: string, data?: LogData): void {
    this.log(LogLevel.Fatal, message, data)
  }
}
