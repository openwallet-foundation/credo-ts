/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

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

  private log(level: Exclude<LogLevel, LogLevel.off>, message: string, data?: Record<string, any>): void {
    // Get console method from mapping
    const consoleLevel = this.consoleLogMap[level]

    // Get logger prefix from log level names in enum
    const prefix = LogLevel[level].toUpperCase()

    // Return early if logging is not enabled for this level
    if (!this.isEnabled(level)) return

    // Log, with or without data
    if (data) {
      console[consoleLevel](`${prefix}: ${message}`, JSON.stringify(data, null, 2))
    } else {
      console[consoleLevel](`${prefix}: ${message}`)
    }
  }

  public test(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.test, message, data)
  }

  public trace(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.trace, message, data)
  }

  public debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.debug, message, data)
  }

  public info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.info, message, data)
  }

  public warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.warn, message, data)
  }

  public error(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.error, message, data)
  }

  public fatal(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.fatal, message, data)
  }
}
