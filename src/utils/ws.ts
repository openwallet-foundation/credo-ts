/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import { isNodeJS, isReactNative } from './environment'

// TODO: we can't depend on @types/ws because it depends on @types/node
// But it would be good to not have to define this type ourselves
interface WebSocket {
  onopen: () => void
  onerror: (error: any) => void
  addEventListener(name: string, handler: (event: any) => void): void
  removeEventListener(name: string, handler: (event: any) => void): void
  close(code?: number, data?: string): void
  send(data: any, cb?: (err?: Error) => void): void

  readonly readyState:
    | WebSocketConstructable['CONNECTING']
    | WebSocketConstructable['OPEN']
    | WebSocketConstructable['CLOSING']
    | WebSocketConstructable['CLOSED']
}

interface WebSocketConstructable {
  new (endpoint: string): WebSocket

  /** The connection is not yet open. */
  readonly CONNECTING: 0
  /** The connection is open and ready to communicate. */
  readonly OPEN: 1
  /** The connection is in the process of closing. */
  readonly CLOSING: 2
  /** The connection is closed. */
  readonly CLOSED: 3
}

let WebSocket: WebSocketConstructable

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
