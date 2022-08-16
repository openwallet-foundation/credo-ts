export enum MediatorDeliveryStrategy {
  // Deliver received messages using push notifications
  Push = 'Push',

  // Deliver received messages using registered web hook
  WebHook = 'WebHook',

  // Deliver received messages using websocket connection
  WebSocket = 'WebSocket',

  // Do not pick up messages
  None = 'None',
}
