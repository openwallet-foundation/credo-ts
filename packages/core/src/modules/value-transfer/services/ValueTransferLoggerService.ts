/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '../../../logger'
import type { Logger as ValueTransferLogger, LogLevel } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferLoggerService implements ValueTransferLogger {
  public logLevel: LogLevel
  private logger: Logger

  public constructor(config: AgentConfig) {
    this.logger = config.logger
    this.logLevel = config.logger.logLevel
  }

  public debug(message: string, data?: Record<string, any>): void {
    this.logger.debug(message, data)
  }

  public error(message: string, data?: Record<string, any>): void {
    this.logger.error(message, data)
  }

  public fatal(message: string, data?: Record<string, any>): void {
    this.logger.fatal(message, data)
  }

  public info(message: string, data?: Record<string, any>): void {
    this.logger.info(message, data)
  }

  public test(message: string, data?: Record<string, any>): void {
    this.logger.test(message, data)
  }

  public trace(message: string, data?: Record<string, any>): void {
    this.logger.trace(message, data)
  }

  public warn(message: string, data?: Record<string, any>): void {
    this.logger.warn(message, data)
  }
}
