import { isNodeJS, isReactNative } from './environment'

let WebSocket: typeof global.WebSocket

// NodeJS doesn't have WebSocket by default
if (isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeWebSocket = require('ws')

  WebSocket = nodeWebSocket
} else if (isReactNative()) {
  WebSocket = global.WebSocket
} else {
  WebSocket = window.WebSocket.bind(window)
}

export { WebSocket }
