/* eslint-disable @typescript-eslint/no-explicit-any */

import { ILogObject, Logger } from 'tslog'
import { LogLevel } from '../logger'
import { BaseLogger } from '../logger/BaseLogger'
import { appendFileSync } from 'fs'

function logToTransport(logObject: ILogObject) {
  appendFileSync('logs.txt', JSON.stringify(logObject) + '\n')
}

export class TestLogger extends BaseLogger {
  private logger: Logger

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

  public constructor(logLevel: LogLevel) {
    super(logLevel)

    this.logger = new Logger({
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

  private log(level: Exclude<LogLevel, LogLevel.off>, message: string, data?: Record<string, any>): void {
    const tsLogLevel = this.tsLogLevelMap[level]

    if (data) {
      this.logger[tsLogLevel](message, data)
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

const testLogger = new TestLogger(LogLevel.error)

export default testLogger
