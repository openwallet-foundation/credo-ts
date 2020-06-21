export enum MessageType {
  ForwardMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routing/1.0/forward',
}

export function createForwardMessage(to: Verkey, msg: any) {
  const forwardMessage = {
    '@type': MessageType.ForwardMessage,
    to,
    msg,
  };
  return forwardMessage;
}
