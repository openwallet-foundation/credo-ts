export enum DidCommMessageForwardingStrategy {
  // When a forward is received, simply queue encrypted message. QueueTransportRepository
  // will be in charge of manually triggering DidCommMessagePickupApi.deliverMessages()
  QueueOnly = 'QueueOnly',

  // Queue message into QueueTransportRepository and, if a Message Pickup Live mode session is active,
  // deliver it along any other queued message
  QueueAndLiveModeDelivery = 'QueueAndLiveModeDelivery',

  // Attempt to deliver message directly if a transport session is available. It will eventually added
  // into pickup queue in case of failure on the delivery
  DirectDelivery = 'DirectDelivery',
}
