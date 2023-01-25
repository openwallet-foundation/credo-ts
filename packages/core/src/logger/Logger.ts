/* eslint-disable @typescript-eslint/no-explicit-any */

export enum LogLevel {
  test = 0,
  trace = 1,
  debug = 2,
  info = 3,
  warn = 4,
  error = 5,
  fatal = 6,
  off = 7,
}

export interface Logger {
  logLevel: LogLevel

  test(message: string, data?: Record<string, any>): void
  trace(message: string, data?: Record<string, any>): void
  debug(message: string, data?: Record<string, any>): void
  info(message: string, data?: Record<string, any>): void
  warn(message: string, data?: Record<string, any>): void
  error(message: string, data?: Record<string, any>): void
  fatal(message: string, data?: Record<string, any>): void
}
