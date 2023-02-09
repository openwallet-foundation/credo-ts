/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ILogObject } from 'tslog'

import { appendFileSync } from 'fs'
import { Logger } from 'tslog'

import { LogLevel } from '../src/logger'
import { BaseLogger } from '../src/logger/BaseLogger'
import { replaceError } from '../src/logger/replaceError'

function logToTransport(logObject: ILogObject) {
  appendFileSync('logs.txt', JSON.stringify(logObject) + '\n')
}

export class TestLogger extends BaseLogger {
  public readonly logger: Logger

  // Map our log levels to tslog levels
  private tsLogLevelMap = {
    [LogLevel.test]: 'silly',
    [LogLevel.trace]: 'trace',
    [LogLevel.debug]: 'debug',
    [LogLevel.info]: 'info',
    [LogLevel.warn]: 'warn',
    [LogLevel.error]: 'error',
    [LogLevel.fatal]: 'fatal',
  } as const

  public static fromLogger(logger: TestLogger, name?: string) {
    return new TestLogger(logger.logLevel, name, logger.logger)
  }

  public constructor(logLevel: LogLevel, name?: string, logger?: Logger) {
    super(logLevel)

    if (logger) {
      this.logger = logger.getChildLogger({
        name,
        minLevel: this.logLevel == LogLevel.off ? undefined : this.tsLogLevelMap[this.logLevel],
      })
    } else {
      this.logger = new Logger({
        name,
        minLevel: this.logLevel == LogLevel.off ? undefined : this.tsLogLevelMap[this.logLevel],
        ignoreStackLevels: 5,
        attachedTransports: [
          {
            transportLogger: {
              silly: logToTransport,
              debug: logToTransport,
              trace: logToTransport,
              info: logToTransport,
              warn: logToTransport,
              error: logToTransport,
              fatal: logToTransport,
            },
            // always log to file
            minLevel: 'silly',
          },
        ],
      })
    }
  }

  private log(level: Exclude<LogLevel, LogLevel.off>, message: string, data?: Record<string, any>): void {
    const tsLogLevel = this.tsLogLevelMap[level]

    if (this.logLevel === LogLevel.off) return

    if (data) {
      this.logger[tsLogLevel](message, JSON.parse(JSON.stringify(data, replaceError, 2)))
    } else {
      this.logger[tsLogLevel](message)
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

const testLogger = new TestLogger(LogLevel.off)

export default testLogger
