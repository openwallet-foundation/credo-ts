export enum MessageForwardingStrategy {
  // When a forward is received, simply queue encrypted message. MessagePickupRepository
  // will be in charge of manually triggering MessagePickupApi.deliver()
  QueueOnly = 'QueueOnly',

  // Queue message into MessagePickupRepository and, if a live mode session si active,
  // deliver it along any other queued message
  QueueAndDeliver = 'QueueAndDeliver',

  // Attempt to deliver message directly. Do not add into pickup queue (it might be manually
  // added after, e.g. in case of failure)
  DeliverOnly = 'DeliverOnly',
}
