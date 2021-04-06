export enum RoutingMessageType {
  // TODO: add other messages from mediator coordination protocol
  KeylistUpdate = 'https://didcomm.org/coordinatemediation/1.0/keylist_update',
  BatchPickup = 'https://didcomm.org/messagepickup/1.0/batch-pickup',
  Batch = 'https://didcomm.org/messagepickup/1.0/batch',
  ForwardMessage = 'https://didcomm.org/routing/1.0/forward',
  RequestMediation = 'https://didcomm.org/coordinate-mediation/1.0/mediate-request', 
  MediationGrant = 'https://didcomm.org/coordinate-mediation/1.0/mediate-grant',
  MediationDeny = 'https://didcomm.org/coordinate-mediation/1.0/mediate-deny',
}
