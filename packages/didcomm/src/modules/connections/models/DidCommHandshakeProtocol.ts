/**
 * Enum values should be sorted based on order of preference. Values will be
 * included in this order when creating out of band invitations.
 *
 * None is used for DIDComm v2 connections which do not require a handshake;
 * connection is established on first message.
 */
export enum DidCommHandshakeProtocol {
  DidExchange = 'https://didcomm.org/didexchange/1.x',
  Connections = 'https://didcomm.org/connections/1.x',
  /** v2: no handshake, connection from OOB + first message */
  None = 'None',
}
