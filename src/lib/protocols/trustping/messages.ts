import uuid from 'uuid/v4';

export enum MessageType {
  TrustPingMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/trust_ping/1.0/ping',
  TrustPingReplyMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/trust_ping/1.0/ping_response',
}

export function createTrustPingMessage(response_requested: boolean = true, comment: string = '') {
  return {
    '@id': uuid(),
    '@type': MessageType.TrustPingMessage,
    ...(comment && { comment }),
    response_requested,
  };
}

export function createTrustPingResponseMessage(thid: string, comment: string = '') {
  return {
    '@id': uuid(),
    '@type': MessageType.TrustPingMessage,
    '~thread': {
      thid,
    },
    ...(comment && { comment }),
  };
}
