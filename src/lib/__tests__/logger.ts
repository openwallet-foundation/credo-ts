import { ILogLevel, ILogObject, Logger } from 'tslog';
import { LogLevel } from '../logger';
import { BaseLogger } from '../logger/BaseLogger';
import { appendFileSync, openSync, closeSync } from 'fs';

function logToTransport(logObject: ILogObject) {
  appendFileSync('logs.txt', JSON.stringify(logObject) + '\n');
}

export class TestLogger extends BaseLogger {
  private logger: Logger;

  private tsLogLevelMap: any = {
    [LogLevel.test]: 'silly',
    [LogLevel.trace]: 'trace',
    [LogLevel.debug]: 'debug',
    [LogLevel.info]: 'info',
    [LogLevel.warn]: 'warn',
    [LogLevel.error]: 'error',
    [LogLevel.fatal]: 'fatal',
  };

  public constructor(logLevel: LogLevel) {
    super(logLevel);

    // clear current log file
    closeSync(openSync('logs.txt', 'w'));
    this.logger = new Logger({
      minLevel: this.tsLogLevelMap[this.logLevel],
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
    });
  }

  private log(level: ILogLevel[keyof ILogLevel], message: string, data?: Record<string, any>): void {
    if (data) {
      this.logger[level](message, data);
    } else {
      this.logger[level](message);
    }
  }

  public test(message: string, data?: Record<string, any>): void {
    this.log('silly', message, data);
  }

  public trace(message: string, data?: Record<string, any>): void {
    this.log('trace', message, data);
  }

  public debug(message: string, data?: Record<string, any>): void {
    this.log('debug', message, data);
  }

  public info(message: string, data?: Record<string, any>): void {
    this.log('info', message, data);
  }

  public warn(message: string, data?: Record<string, any>): void {
    this.log('warn', message, data);
  }

  public error(message: string, data?: Record<string, any>): void {
    this.log('error', message, data);
  }

  public fatal(message: string, data?: Record<string, any>): void {
    this.log('fatal', message, data);
  }
}

const testLogger = new TestLogger(LogLevel.error);

export default testLogger;
