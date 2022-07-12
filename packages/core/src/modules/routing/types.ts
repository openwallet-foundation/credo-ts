export const offlineTransports = ['nfc', 'ipc', 'ble']
export const onlineTransports = ['http', 'https', 'ws', 'wss']

export type Transport = 'http' | 'https' | 'ws' | 'wss' | 'nfc' | 'ipc' | 'ble'
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
