/* eslint-disable @typescript-eslint/ban-ts-comment */
import { isNodeJS, isReactNative } from './environment'

let WebSocket: any

// NodeJS doesn't have WebSocket by default
if (isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeWebSocket = require('ws')

  WebSocket = nodeWebSocket
} else if (isReactNative()) {
  // @ts-ignore
  WebSocket = global.WebSocket
} else {
  // @ts-ignore
  WebSocket = window.WebSocket.bind(window)
}

export { WebSocket }
