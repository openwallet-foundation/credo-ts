import uuid from 'uuid/v4';

export enum MessageType {
  RouteUpdateMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routecoordination/1.0/keylist_update',
  ForwardMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routing/1.0/forward',
}

export function createRouteUpdateMessage(recipientKey: Verkey) {
  return {
    '@id': uuid(),
    '@type': MessageType.RouteUpdateMessage,
    updates: [
      {
        recipient_key: recipientKey,
        action: 'add', // "add" or "remove"
      },
    ],
  };
}

export function createForwardMessage(to: Verkey, msg: any) {
  const forwardMessage = {
    '@type': MessageType.ForwardMessage,
    to,
    msg,
  };
  return forwardMessage;
}
