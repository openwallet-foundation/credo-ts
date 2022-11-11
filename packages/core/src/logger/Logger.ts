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
  logId?: string
}

export interface EnrichedLogMessage extends LogData {
  context?: string
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

  createContextLogger(context: string): Logger
}

export const LogContexts = {
  RecipientModule: {
    context: 'RecipientModule',
    mediationWebSocketUnableToOpenConnection: 'mediation-socket:unable-to-open-connection',
    mediationWebSocketReconnect: 'mediation-socket:reconnect-attempt',
  },
  WsOutboundTransport: {
    context: 'WsOutboundTransport',
    connecting: 'connecting',
    connected: 'connected',
    connectError: 'connect-error',
    closing: 'closing',
  },
  HttpOutboundTransport: {
    context: 'httpOutboundTransport',
    errorSendingMessage: 'error-sending-message',
  },
  MessageSender: {
    context: 'messageSender',
    prepareToSend: 'prepare-to-send',
  },
}
