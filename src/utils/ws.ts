import { isNodeJS, isReactNative } from './environment'

let WebSocket

// NodeJS doesn't have WebSocket by default
if (!WebSocket && isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeWebSocket = require('ws')

  WebSocket = nodeWebSocket
} else if (!WebSocket && isReactNative()) {
  WebSocket = global.WebSocket
} else {
  WebSocket = window.WebSocket.bind(window)
}

export { WebSocket }
