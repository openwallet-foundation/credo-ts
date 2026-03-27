import type { ILogObj } from 'tslog'
import { Logger } from 'tslog'
import { LogLevel } from '../src/logger'
import { BaseLogger } from '../src/logger/BaseLogger'
import { replaceError } from '../src/logger/replaceError'

export class TestLogger extends BaseLogger {
  public readonly logger: Logger<ILogObj>

  // Map our log levels to tslog levels
  private tsLogLevelStringMap = {
    [LogLevel.Test]: 'silly',
    [LogLevel.Trace]: 'trace',
    [LogLevel.Debug]: 'debug',
    [LogLevel.Info]: 'info',
    [LogLevel.Warn]: 'warn',
    [LogLevel.error]: 'error',
    [LogLevel.Fatal]: 'fatal',
  } as const

  // Map our log levels to tslog levels
  private tsLogLevelNumberMap = {
    [LogLevel.Test]: 0,
    [LogLevel.Trace]: 1,
    [LogLevel.Debug]: 2,
    [LogLevel.Info]: 3,
    [LogLevel.Warn]: 4,
    [LogLevel.error]: 5,
    [LogLevel.Fatal]: 6,
  } as const

  public static fromLogger(logger: TestLogger, name?: string) {
    return new TestLogger(logger.logLevel, name, logger.logger)
  }

  public constructor(logLevel: LogLevel, name?: string, logger?: Logger<ILogObj>) {
    super(logLevel)

    if (logger) {
      this.logger = logger.getSubLogger({
        name,
        minLevel: this.logLevel === LogLevel.Off ? undefined : this.tsLogLevelNumberMap[this.logLevel],
      })
    } else {
      this.logger = new Logger({
        name,
        minLevel: this.logLevel === LogLevel.Off ? undefined : this.tsLogLevelNumberMap[this.logLevel],
      })
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  private log(level: Exclude<LogLevel, LogLevel.Off>, message: string, data?: Record<string, any>): void {
    const tsLogLevel = this.tsLogLevelStringMap[level]

    if (this.logLevel === LogLevel.Off) return

    if (data) {
      this.logger[tsLogLevel](message, JSON.parse(JSON.stringify(data, replaceError, 2)))
    } else {
      this.logger[tsLogLevel](message)
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public test(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.Test, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public trace(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.Trace, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.Debug, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.Info, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.Warn, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public error(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.error, message, data)
  }

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public fatal(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.Fatal, message, data)
  }
}

const testLogger = new TestLogger(LogLevel.Off)

export default testLogger
