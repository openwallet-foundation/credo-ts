export enum HandshakeProtocol {
  Connections = 'https://didcomm.org/connections/1.0',
  DidExchange = 'https://didcomm.org/didexchange/1.0',
  None = 'None', // Used as an explicit marker for DidCommV2 connections which do not require handshake
}
