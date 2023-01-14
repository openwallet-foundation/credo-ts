/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { BaseLogger } from './BaseLogger'
import { LogLevel } from './Logger'
import { replaceError } from './replaceError'
import chalk from 'chalk'
const ansiCodes = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

type ANSICode = keyof typeof ansiCodes;


export class FancyLogger extends BaseLogger {
  // Map our log levels to console levels
  private consoleLogMap = {
    [LogLevel.test]: 'log',
    [LogLevel.trace]: 'log',
    [LogLevel.debug]: 'debug',
    [LogLevel.info]: 'info',
    [LogLevel.warn]: 'warn',
    [LogLevel.error]: 'error',
    [LogLevel.fatal]: 'error',
  } as const;

  private scope?: string

  public constructor(logLevel: LogLevel = LogLevel.off, scope?: string) {
    super(logLevel)
    this.scope = scope
  }


  private formatString = (str: string, codes: ANSICode[]): string =>
    codes.reduce((acc, code) => acc + ansiCodes[code], str);

  private log(level: Exclude<LogLevel, LogLevel.off>, message: string, data?: Record<string, any>): void {
    // Get console method from mapping
    const consoleLevel = this.consoleLogMap[level];

    const timestamp = new Date().toISOString().
      replace(/T/, ' ').      // replace T with a space
      replace(/\..+/, '')     // delete the dot and everything after


    // Get logger prefix from log level names in enum
    const prefix = LogLevel[level].toUpperCase()

    const colorLogLevel = (level: LogLevel, message: string) => {
      switch (level) {
        case 0:
          return chalk.white(message)
        case 1:
          return chalk.white(message)
        case 2:
          return chalk.magenta(message)
        case 3:
          return chalk.green(message)
        case 4:
          return chalk.blue(message)
        case 5:
          return chalk.yellow(message)
        case 6:
          return chalk.red(message)
        case 7:
          return chalk.red.bold(message)
        default:
          return chalk.bgGrey(message)
      }

    }

    // Return early if logging is not enabled for this level
    if (!this.isEnabled(level)) return


    let messageString = ''


    messageString = messageString
      .concat(chalk.grey(`[${timestamp}]`))
      .concat(' - ')
      .concat(colorLogLevel(level, LogLevel[level].toUpperCase().padEnd(5)))
      .concat(' :: ')

    if (this.scope) {
      messageString = messageString.concat(chalk.yellow(`[${this.scope}]`))
    } else {
      messageString = messageString.concat(chalk.yellow(`[GENERAL]`))
    }

    messageString = messageString
      .concat(' :: ').concat(colorLogLevel(level, message))


    // Log, with or without data
    if (data) {
      // const formattedData = this.formatString(JSON.stringify(data, replaceError, 2), codes)
      console[consoleLevel](messageString, JSON.stringify(data, replaceError, 2))
    } else {
      console[consoleLevel](messageString)
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

  public scoped(scope: string) {
    return new FancyLogger(this.logLevel, scope)
  }
}



