export enum ConnectionMessageType {
  ConnectionInvitation = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/invitation',
  ConnectionRequest = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/request',
  ConnectionResponse = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/response',
  Ack = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/notification/1.0/ack',
  TrustPingMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/trust_ping/1.0/ping',
  TrustPingResponseMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/trust_ping/1.0/ping_response',
}
