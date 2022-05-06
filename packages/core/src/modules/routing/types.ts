export const DIDCommAip1Profile: AcceptProtocol = 'didcomm/aip1'
export const DIDCommV2Profile: AcceptProtocol = 'didcomm/v2'
export const defaultProfiles = [DIDCommAip1Profile, DIDCommV2Profile]

export const nfcTransport = 'didcomm://nfc'
export const offlineTransports = ['didcomm://nfc']
export const onlineTransports = ['didcomm://http', 'didcomm://https', 'didcomm://ws', 'didcomm://wss']

export type Transport = 'didcomm://http' | 'didcomm://https' | 'didcomm://ws' | 'didcomm://wss' | 'didcomm://nfc'
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

  /**
   * Identifier of the DIDComm protocol to use
   */
  accept?: AcceptProtocol[]
}
