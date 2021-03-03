export enum MessageType {
  // TODO: add other messages from mediator coordination protocol
  KeylistUpdate = 'https://didcomm.org/coordinatemediation/1.0/keylist_update',
  BatchPickup = 'https://didcomm.org/messagepickup/1.0/batch-pickup',
  Batch = 'https://didcomm.org/messagepickup/1.0/batch',
  ForwardMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routing/1.0/forward',
}
