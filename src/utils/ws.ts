import { isNodeJS } from './environment'

// RN exposes global WebSocket
let WebSocket = global.WebSocket

// NodeJS doesn't have WebSocket by default
if (!WebSocket && isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeWebSocket = require('ws')

  WebSocket = nodeWebSocket
}

export { WebSocket }
