import type { Server } from 'node:http'
import type { HttpHandler, HttpHandlerHost } from '@credo-ts/core/http'
import express, { type Express } from 'express'
import { ExpressHost } from '../express'

// Allow the default DIDComm processing timeout (10 seconds) to elapse before force-closing requests.
const HTTP_SERVER_DRAIN_TIMEOUT_MS = 15_000

/**
 * Owns an HTTP listener while reusing the Express adapter for Fetch-style handler dispatch.
 */
export class HttpServerHost implements HttpHandlerHost {
  public readonly app: Express = express()
  private readonly expressHost = new ExpressHost({ app: this.app })
  private readonly attachedHandlers = new Set<HttpHandler>()
  private readonly port: number
  private _server?: Server
  private lifecycle: Promise<void> = Promise.resolve()

  public constructor({ port }: { port: number }) {
    this.port = port
  }

  public get server() {
    return this._server
  }

  public attach(handler: HttpHandler): Promise<void> {
    return this.enqueue(async () => {
      if (this.attachedHandlers.has(handler)) return
      await this.expressHost.attach(handler)
      this.attachedHandlers.add(handler)
      if (this._server) return

      const server = this.app.listen(this.port)
      this._server = server
      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (error: Error) => {
            server.off('listening', onListening)
            reject(error)
          }
          const onListening = () => {
            server.off('error', onError)
            resolve()
          }
          server.once('error', onError)
          server.once('listening', onListening)
        })
      } catch (error) {
        this.attachedHandlers.delete(handler)
        this._server = undefined
        await this.expressHost.detach(handler)
        throw error
      }
    })
  }

  public detach(handler: HttpHandler): Promise<void> {
    return this.enqueue(async () => {
      if (!this.attachedHandlers.delete(handler)) return
      await this.expressHost.detach(handler)
      if (this.attachedHandlers.size > 0) return

      const server = this._server
      if (!server) return

      await new Promise<void>((resolve, reject) => {
        const drainTimeout = setTimeout(() => server.closeAllConnections(), HTTP_SERVER_DRAIN_TIMEOUT_MS)

        server.close((error) => {
          clearTimeout(drainTimeout)
          if (this._server === server) this._server = undefined
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
}

/**
 * Creates a Credo-owned HTTP listener, backed by an internal Express application.
 */
export function httpServerHost(options: { port: number }): HttpServerHost {
  return new HttpServerHost(options)
}
