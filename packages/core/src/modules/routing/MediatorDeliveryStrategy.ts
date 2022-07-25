export enum MediatorDeliveryStrategy {
  // Deliver received messages using push notifications
  Push = 'Push',

  // Deliver received messages using registered web hook
  WebHook = 'WebHook',

  // Do not pick up messages
  None = 'None',
}
