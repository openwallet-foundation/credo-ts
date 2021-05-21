import { isNodeJS, isReactNative } from './environment'

type WS = {
  new (url: string, protocols?: string | string[] | undefined): WebSocket
  prototype: WebSocket
  readonly CLOSED: number
  readonly CLOSING: number
  readonly CONNECTING: number
  readonly OPEN: number
}

let WebSocket: WS

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
