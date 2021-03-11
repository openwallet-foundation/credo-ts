/* eslint-disable no-console */

import { BaseLogger } from './BaseLogger';
import { LogLevel } from './Logger';

export class ConsoleLogger extends BaseLogger {
  private formatData = (data: Record<string, unknown>) => JSON.stringify(data, null, 2);

  public test(message: string, data?: Record<string, unknown>): void {
    if (this.isEnabled(LogLevel.test)) {
      data ? console.log('TEST: ' + message, this.formatData(data)) : console.log('TEST: ' + message);
    }
  }

  public trace(message: string, data?: Record<string, unknown>): void {
    if (this.isEnabled(LogLevel.trace)) {
      data ? console.debug('TRACE: ' + message, this.formatData(data)) : console.debug('TRACE: ' + message);
    }
  }

  public debug(message: string, data?: Record<string, unknown>): void {
    if (this.isEnabled(LogLevel.debug)) {
      data ? console.debug('DEBUG: ' + message, this.formatData(data)) : console.debug('DEBUG: ' + message);
    }
  }

  public info(message: string, data?: Record<string, unknown>): void {
    if (this.isEnabled(LogLevel.info)) {
      data ? console.info('INFO: ' + message, this.formatData(data)) : console.info('INFO: ' + message);
    }
  }

  public warn(message: string, data?: Record<string, unknown>): void {
    if (this.isEnabled(LogLevel.warn)) {
      data ? console.warn('WARN: ' + message, this.formatData(data)) : console.warn('WARN: ' + message);
    }
  }

  public error(message: string, data?: Record<string, unknown>): void {
    if (this.isEnabled(LogLevel.error)) {
      data ? console.error('ERROR: ' + message, this.formatData(data)) : console.error('ERROR: ' + message);
    }
  }

  public fatal(message: string, data?: Record<string, unknown>): void {
    if (this.isEnabled(LogLevel.fatal)) {
      data ? console.error('FATAL: ' + message, this.formatData(data)) : console.error('FATAL: ' + message);
    }
  }
}
