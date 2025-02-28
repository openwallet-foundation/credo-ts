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

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  test(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  trace(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  debug(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  info(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  warn(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  error(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  fatal(message: string, data?: Record<string, any>): void
}
