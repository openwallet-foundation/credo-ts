import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'

/**
 * Accepts connections from {@link WebSocketHost}. Satisfied structurally by the DIDComm WebSocket inbound transport.
 */
interface WebSocketHostAcceptor {
  accept(socket: WebSocket): void
}

export type WebSocketHostOptions = { server: WebSocketServer; port?: undefined } | { server?: undefined; port: number }

// Close code 1013 "Try Again Later": the server is up but the agent is not accepting connections.
const TRY_AGAIN_LATER = 1013

/**
 * Accepts DIDComm WebSocket connections from a `ws` WebSocketServer.
 *
 * When `port` is provided the host creates the server when an acceptor is attached, and closes it
 * when the acceptor is detached. When `server` is provided the application owns the server and how
 * connections reach it (for example `noServer` with `handleUpgrade`): it is never closed by the host,
 * and while no acceptor is attached (before the agent starts or after it stops) new connections are
 * closed with code 1013, so a stopped agent holds no sockets and the agent can be started again.
 */
export class WebSocketHost {
  private port?: number
  private _server?: WebSocketServer
  private connectionListeners = new Map<WebSocketHostAcceptor, (socket: WebSocket) => void>()
  private readonly rejectConnection = (socket: WebSocket) => socket.close(TRY_AGAIN_LATER)

  public get server() {
    return this._server
  }

  public constructor({ server, port }: WebSocketHostOptions) {
    this._server = server
    this.port = port

    if (server) {
      this.rejectConnectionsOn(server)
    }
  }

  public async attach(acceptor: WebSocketHostAcceptor): Promise<void> {
    const server = this._server ?? (await this.listen())
    server.off('connection', this.rejectConnection)

    const listener = (socket: WebSocket) => acceptor.accept(socket)
    this.connectionListeners.set(acceptor, listener)
    server.on('connection', listener)
  }

  public async detach(acceptor: WebSocketHostAcceptor): Promise<void> {
    const server = this._server
    if (!server) {
      return
    }

    const listener = this.connectionListeners.get(acceptor)
    if (listener) {
      server.off('connection', listener)
      this.connectionListeners.delete(acceptor)
    }

    if (this.port === undefined) {
      if (this.connectionListeners.size === 0) {
        this.rejectConnectionsOn(server)
      }
      return
    }

    this._server = undefined

    return new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
        }
        resolve()
      })
    })
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
        this._server = undefined
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

export function webSocketHost(options: WebSocketHostOptions): WebSocketHost {
  return new WebSocketHost(options)
}
