export enum RoutingMessageType {
  // TODO: add other messages from mediator coordination protocol
  MediationRequest = 'https://didcomm.org/coordinate-mediation/1.0/mediate-request',
  MediationDeny = 'https://didcomm.org/coordinate-mediation/1.0/mediate-deny',
  MediationGrant = 'https://didcomm.org/coordinate-mediation/1.0/mediate-grant',
  KeylistUpdate = 'https://didcomm.org/coordinate-mediation/1.0/keylist-update',
  KeylistUpdateResponse = 'https://didcomm.org/coordinate-mediation/1.0/keylist-update-response',
  BatchPickup = 'https://didcomm.org/messagepickup/1.0/batch-pickup',
  Batch = 'https://didcomm.org/messagepickup/1.0/batch',
  ForwardMessage = 'https://didcomm.org/routing/1.0/forward',
  RequestMediation = 'https://didcomm.org/coordinate-mediation/1.0/mediate-request',
}
