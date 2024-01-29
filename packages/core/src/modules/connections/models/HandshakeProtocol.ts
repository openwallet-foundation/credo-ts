import { parseMessageType } from '../../../utils/messageType'

/**
 * Enum values should be sorted based on order of preference. Values will be
 * included in this order when creating out of band invitations.
 */
export enum HandshakeProtocol {
  DidExchange = 'https://didcomm.org/didexchange/1.x',
  Connections = 'https://didcomm.org/connections/1.x',
}

/**
 * Get the handshake protocol passed in, but with the minor version replaces with an x.
 *
 * E.g. `https://didocmm.org/connections/1.1` becomes `https://didcomm.org/connections/1.x`
 * This allows to match message types but ignoring the minor version.
 */
export function getHandshakeProtocolWithoutMinorVersion(handshakeProtocol: string) {
  // handshake protocol does not include message type so we add dummy message to be able
  // to parse it using parseMessageType
  const parsed = parseMessageType(`${handshakeProtocol}/dummy-message`)

  return `${parsed.documentUri}/${parsed.protocolName}/${parsed.protocolMajorVersion}.x`
}
