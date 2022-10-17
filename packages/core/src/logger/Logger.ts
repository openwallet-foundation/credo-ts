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

export interface LogData extends Record<string, any> {
  context?: string
  logId?: string
}

export interface Logger {
  logLevel: LogLevel

  test(message: string, data?: LogData): void
  trace(message: string, data?: LogData): void
  debug(message: string, data?: LogData): void
  info(message: string, data?: LogData): void
  warn(message: string, data?: LogData): void
  error(message: string, data?: LogData): void
  fatal(message: string, data?: LogData): void
}

export interface LogContext extends Record<string, any> {
  context: string
}

export const LogContexts = {
  mediationWebSocket: {
    context: 'mediationWebSocket',
    unableToOpenConnection: 'unable-to-open-connection',
    reconnect: 'reconnect-attempt',
  },
  wsOutboundTransport: {
    context: 'wbOutboundTransport',
    connecting: 'connecting',
    connected: 'connected',
    connectError: 'connect-error',
    closing: 'closing',
  },
  httpOutboundTransport: {
    context: 'httpOutboundTransport',
    errorSendingMessage: 'error-sending-message',
  },
  messageSender: {
    context: 'messageSender',
    prepareToSend: 'prepare-to-send',
  },
}
