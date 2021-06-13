export enum RoutingMessageType {
  // TODO: add other messages from mediator coordination protocol
  KeylistUpdate = 'https://didcomm.org/coordinatemediation/1.0/keylist-update',
  KeylistUpdateResponse = 'https://didcomm.org/coordinatemediation/1.0/keylist-update-response',
  BatchPickup = 'https://didcomm.org/messagepickup/1.0/batch-pickup',
  Batch = 'https://didcomm.org/messagepickup/1.0/batch',
  ForwardMessage = 'https://didcomm.org/routing/1.0/forward',
}
