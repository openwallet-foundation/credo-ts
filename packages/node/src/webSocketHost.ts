import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'

/**
 * Accepts connections from {@link WebSocketHost}. Satisfied structurally by the DIDComm WebSocket inbound transport.
 */
interface WebSocketHostAcceptor {
  accept(socket: WebSocket): void
}

export type WebSocketHostOptions = { server: WebSocketServer; port?: undefined } | { server?: undefined; port: number }

/**
 * Accepts DIDComm WebSocket connections from a `ws` WebSocketServer.
 *
 * When `port` is provided the host creates the server when an acceptor is attached. When `server`
 * is provided the application owns how connections reach it (for example `noServer` with `handleUpgrade`).
 * In both cases the server is closed when the acceptor is detached.
 */
export class WebSocketHost {
  private port?: number
  private _server?: WebSocketServer
  private connectionListeners = new Map<WebSocketHostAcceptor, (socket: WebSocket) => void>()

  public get server() {
    return this._server
  }

  public constructor({ server, port }: WebSocketHostOptions) {
    this._server = server
    this.port = port
  }

  public async attach(acceptor: WebSocketHostAcceptor): Promise<void> {
    const server = this._server ?? (await this.listen())

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

    if (this.port !== undefined) {
      this._server = undefined
    }

    return new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
        }
        resolve()
      })
    })
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
