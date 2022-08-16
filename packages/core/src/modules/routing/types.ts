export enum Transports {
  HTTP = 'http',
  HTTPS = 'https',
  WS = 'ws',
  WSS = 'wss',
  NFC = 'nfc',
  Nearby = 'androidnearby',
}

export const offlineTransports = [Transports.NFC, Transports.Nearby]
export const onlineTransports = [Transports.HTTP, Transports.HTTPS, Transports.WS, Transports.WSS]

export type AcceptProtocol = 'didcomm/aip1' | 'didcomm/v2'

export interface GetRoutingOptions {
  /**
   * Identifier of the mediator to use when setting up routing
   */
  mediatorId?: string

  /**
   * Whether to use the default mediator if available and `mediatorId` has not been provided
   * @default true
   */
  useDefaultMediator?: boolean
}

export const isOnlineTransport = (transport: Transports) =>
  transport === Transports.HTTPS ||
  transport === Transports.HTTP ||
  transport === Transports.WSS ||
  transport === Transports.WS

export const isOfflineTransport = (transport: Transports) =>
  transport === Transports.NFC || transport === Transports.Nearby

export const hasOnlineTransport = (transports: Transports[]) =>
  transports.includes(Transports.HTTPS) ||
  transports.includes(Transports.HTTP) ||
  transports.includes(Transports.WSS) ||
  transports.includes(Transports.WS)

export const hasOfflineTransport = (transports: Transports[]) =>
  transports.includes(Transports.NFC) || transports.includes(Transports.Nearby)
