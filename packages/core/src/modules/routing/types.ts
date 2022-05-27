export const DIDCommAip1Profile: AcceptProtocol = 'didcomm/aip1'
export const DIDCommV2Profile: AcceptProtocol = 'didcomm/v2'
export const defaultAcceptProfiles = [DIDCommAip1Profile, DIDCommV2Profile]

export const offlineTransports = ['nfc', 'ipc']
export const onlineTransports = ['http', 'https', 'ws', 'wss']

export type DIDTransports = { [did: string]: Transport }

export type Transport = 'http' | 'https' | 'ws' | 'wss' | 'nfc' | 'ipc'
export type AcceptProtocol = 'didcomm/aip1' | 'didcomm/v2'

export interface GetRoutingOptions {
  /**
   * Identifier of the mediator to use when setting up routing
   */
  mediatorId?: string

  /**
   * Identifier the transport to use
   */
  transport?: Transport

  /**
   * Whether to use the default mediator if available and `mediatorId` has not been provided
   * @default true
   */
  useDefaultMediator?: boolean
}
