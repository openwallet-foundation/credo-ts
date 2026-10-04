import { TypedArrayEncoder } from '@credo-ts/core'
import type { WebSocketAcceptor, WebSocketAcceptorHost, WebSocketLike } from '@credo-ts/core/websocket'
import type { WebSocket as WsSocket } from 'ws'
import WebSocket, { WebSocketServer } from 'ws'

export type WebSocketHostOptions = { server: WebSocketServer; port?: undefined } | { server?: undefined; port: number }

const TRY_AGAIN_LATER = 1013

/**
 * Accepts framework-neutral WebSocket connections from a `ws` WebSocketServer.
 *
 * When `port` is provided the host creates the server when an acceptor is attached, and closes it
 * when the acceptor is detached. When `server` is provided the application owns the server: it is
 * never closed by the host, and connections are rejected while no acceptor is attached.
 */
export class WebSocketHost implements WebSocketAcceptorHost {
  private readonly port?: number
  private _server?: WebSocketServer
  private readonly acceptors = new Map<
    WebSocketAcceptor,
    { listener: (socket: WsSocket) => void; sockets: Set<WsSocket> }
  >()
  private lifecycle: Promise<void> = Promise.resolve()
  private readonly rejectConnection = (socket: WsSocket) => socket.close(TRY_AGAIN_LATER)

  public get server() {
    return this._server
  }

  public constructor({ server, port }: WebSocketHostOptions) {
    this._server = server
    this.port = port
    if (server) this.rejectConnectionsOn(server)
  }

  public attach(acceptor: WebSocketAcceptor): Promise<void> {
    return this.enqueue(async () => {
      if (this.acceptors.has(acceptor)) return
      if (this.acceptors.size > 0) {
        throw new Error('A WebSocket host can attach only one acceptor because it has no path-routing contract')
      }

      const server = this._server ?? (await this.listen())
      server.off('connection', this.rejectConnection)

      const sockets = new Set<WebSocket>()
      const listener = (socket: WsSocket) => {
        // TODO: Optionally ping accepted sockets and terminate those that miss a pong; avoid
        // conflicting with an application-owned server's heartbeat policy.
        sockets.add(socket)
        socket.once('close', () => sockets.delete(socket))
        try {
          acceptor.accept(new WsSocketAdapter(socket))
        } catch (error) {
          socket.terminate()
          const details = error instanceof Error ? (error.stack ?? error.message) : String(error)
          process.stderr.write(`Failed to pass a WebSocket connection to its acceptor: ${details}\n`)
        }
      }

      this.acceptors.set(acceptor, { listener, sockets })
      server.on('connection', listener)
    })
  }

  public detach(acceptor: WebSocketAcceptor): Promise<void> {
    return this.enqueue(async () => {
      const attached = this.acceptors.get(acceptor)
      if (!attached) return

      this.acceptors.delete(acceptor)
      const server = this._server
      if (!server) return

      server.off('connection', attached.listener)
      for (const socket of attached.sockets) socket.terminate()
      attached.sockets.clear()

      if (this.port === undefined) {
        this.rejectConnectionsOn(server)
        return
      }

      this._server = undefined
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    })
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.lifecycle.then(operation, operation)
    this.lifecycle = result.catch(() => undefined)
    return result
  }

  private rejectConnectionsOn(server: WebSocketServer) {
    server.off('connection', this.rejectConnection)
    server.on('connection', this.rejectConnection)
  }

  private async listen(): Promise<WebSocketServer> {
    const server = new WebSocketServer({ port: this.port })
    this._server = server

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off('listening', onListening)
        if (this._server === server) this._server = undefined
        reject(error)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve()
      }

      server.once('error', onError)
      server.once('listening', onListening)
    })

    return server
  }
}

class WsSocketAdapter implements WebSocketLike {
  private readonly listeners = new Map<string, Map<unknown, () => void>>()

  public get readyState() {
    return this.socket.readyState
  }

  public get OPEN() {
    return WebSocket.OPEN
  }

  public get CLOSING() {
    return WebSocket.CLOSING
  }

  public get CLOSED() {
    return WebSocket.CLOSED
  }

  public constructor(private readonly socket: WsSocket) {}

  public send(data: string | Uint8Array): void {
    this.socket.send(data)
  }

  public close(code?: number, reason?: string): void {
    this.socket.close(code, reason)
  }

  public addEventListener(type: 'open' | 'close', listener: () => void): void
  public addEventListener(type: 'error', listener: (event: unknown) => void): void
  public addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void
  public addEventListener(
    type: 'open' | 'close' | 'error' | 'message',
    listener: (() => void) | ((event: unknown) => void) | ((event: { readonly data: unknown }) => void)
  ): void {
    let wrapper: () => void

    if (type === 'message') {
      wrapper = () => {}
      const messageListener = (data: WebSocket.RawData, isBinary: boolean) => {
        const bytes =
          data instanceof Uint8Array
            ? data
            : data instanceof ArrayBuffer
              ? new Uint8Array(data)
              : TypedArrayEncoder.concat(data)
        ;(listener as (event: { readonly data: unknown }) => void)({
          data: isBinary ? bytes : TypedArrayEncoder.toUtf8String(bytes),
        })
      }
      this.socket.on(type, messageListener)
      wrapper = () => this.socket.off(type, messageListener)
    } else {
      const eventListener = (event?: unknown) => (listener as (event: unknown) => void)(event)
      this.socket.on(type, eventListener)
      wrapper = () => this.socket.off(type, eventListener)
    }

    const typeListeners = this.listeners.get(type) ?? new Map()
    typeListeners.set(listener, wrapper)
    this.listeners.set(type, typeListeners)
  }

  public removeEventListener(type: 'open' | 'close', listener: () => void): void
  public removeEventListener(type: 'error', listener: (event: unknown) => void): void
  public removeEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void
  public removeEventListener(type: 'open' | 'close' | 'error' | 'message', listener: unknown): void {
    const typeListeners = this.listeners.get(type)
    const wrapper = typeListeners?.get(listener)
    if (!wrapper) return
    wrapper()
    typeListeners?.delete(listener)
  }
}

export function webSocketHost(options: WebSocketHostOptions): WebSocketHost {
  return new WebSocketHost(options)
}
