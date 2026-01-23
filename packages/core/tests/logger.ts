import type { ILogObj } from 'tslog'
import { Logger } from 'tslog'

import { LogLevel } from '../src/logger'
import { BaseLogger } from '../src/logger/BaseLogger'
import { replaceError } from '../src/logger/replaceError'

export class TestLogger extends BaseLogger {
  public readonly logger: Logger<ILogObj>

  // Map our log levels to tslog levels
  private tsLogLevelStringMap = {
    [LogLevel.test]: 'silly',
    [LogLevel.trace]: 'trace',
    [LogLevel.debug]: 'debug',
    [LogLevel.info]: 'info',
    [LogLevel.warn]: 'warn',
    [LogLevel.error]: 'error',
    [LogLevel.fatal]: 'fatal',
  } as const

  // Map our log levels to tslog levels
  private tsLogLevelNumberMap = {
    [LogLevel.test]: 0,
    [LogLevel.trace]: 1,
    [LogLevel.debug]: 2,
    [LogLevel.info]: 3,
    [LogLevel.warn]: 4,
    [LogLevel.error]: 5,
    [LogLevel.fatal]: 6,
  } as const

  public static fromLogger(logger: TestLogger, name?: string) {
    return new TestLogger(logger.logLevel, name, logger.logger)
  }

  public constructor(logLevel: LogLevel, name?: string, logger?: Logger<ILogObj>) {
    super(logLevel)

    if (logger) {
      this.logger = logger.getSubLogger({
        name,
        minLevel: this.logLevel === LogLevel.off ? undefined : this.tsLogLevelNumberMap[this.logLevel],
      })
    } else {
      this.logger = new Logger({
        name,
        minLevel: this.logLevel === LogLevel.off ? undefined : this.tsLogLevelNumberMap[this.logLevel],
      })
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  private log(level: Exclude<LogLevel, LogLevel.off>, message: string, data?: Record<string, any>): void {
    const tsLogLevel = this.tsLogLevelStringMap[level]

    if (this.logLevel === LogLevel.off) return

    if (data) {
      this.logger[tsLogLevel](message, JSON.parse(JSON.stringify(data, replaceError, 2)))
    } else {
      this.logger[tsLogLevel](message)
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public test(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.test, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public trace(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.trace, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.debug, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.info, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.warn, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public error(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.error, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public fatal(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.fatal, message, data)
  }
}

const testLogger = new TestLogger(LogLevel.trace)

export default testLogger
