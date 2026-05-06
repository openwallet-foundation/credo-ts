export enum LogLevel {
  Test,
  Trace,
  Debug,
  Info,
  Warn,
  Error,
  Fatal,
  Off,
}

export interface Logger {
  logLevel: LogLevel

  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  test(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  trace(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  debug(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  info(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  warn(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  error(message: string, data?: Record<string, any>): void
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  fatal(message: string, data?: Record<string, any>): void
}
