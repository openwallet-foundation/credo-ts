import type { Express, Request, Response } from 'express'
import express, { text } from 'express'
import type { Server } from 'http'

/**
 * A route served by {@link ExpressHost}. Satisfied structurally by the DIDComm HTTP inbound transport.
 */
interface ExpressHostBinding {
  readonly path: string
  readonly contentTypes: string[]
  readonly maxBodyBytes: number
  handle(request: ExpressHostRequest, response: ExpressHostResponse): Promise<void>
}

interface ExpressHostRequest {
  readonly body?: string
  readonly contentType?: string
  onClose(listener: () => void): void
}

interface ExpressHostResponse {
  readonly headersSent: boolean
  send(statusCode: number, body?: string, contentType?: string): void
}

export type ExpressHostOptions = { app: Express; port?: undefined } | { app?: Express; port: number }

// Allow the default DIDComm processing timeout (10 seconds) to elapse before force-closing requests.
const HTTP_SERVER_DRAIN_TIMEOUT_MS = 15_000

/**
 * Serves DIDComm HTTP inbound routes on an Express application.
 *
 * When `port` is provided the host starts listening when the first route is attached, and closes the
 * listener after the last route is detached. Reuse one host instance when transports should share its listener.
 * When only `app` is provided the application owns the listener.
 */
export class ExpressHost {
  public readonly app: Express
  private readonly port?: number
  private _server?: Server
  private attachedBindings = new Set<ExpressHostBinding>()
  private registeredBindings = new Set<ExpressHostBinding>()
  private lifecycle: Promise<void> = Promise.resolve()

  public get server() {
    return this._server
  }

  public constructor({ app, port }: ExpressHostOptions) {
    this.port = port

    // Use the caller-provided Express app, or create one
    this.app = app ?? express()
  }

  public attach(binding: ExpressHostBinding): Promise<void> {
    return this.enqueue(async () => {
      if (this.attachedBindings.has(binding)) return

      if (!this.registeredBindings.has(binding)) {
        this.app.post(binding.path, text({ type: binding.contentTypes, limit: binding.maxBodyBytes }), (req, res) =>
          binding.handle(toHostRequest(req), toHostResponse(res))
        )
        this.registeredBindings.add(binding)
      }

      this.attachedBindings.add(binding)

      if (this.port === undefined || this._server) return

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
        this.attachedBindings.delete(binding)
        if (this._server === server) this._server = undefined
        throw error
      }
    })
  }

  public detach(binding: ExpressHostBinding): Promise<void> {
    return this.enqueue(async () => {
      if (!this.attachedBindings.delete(binding) || this.port === undefined || this.attachedBindings.size > 0) return

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
export function httpServerHost(options: { port: number }): ExpressHost {
  return new ExpressHost(options)
}

/**
 * Attaches DIDComm routes to an application-owned Express app without managing its listener.
 */
export function expressHost(options: { app: Express }): ExpressHost {
  return new ExpressHost(options)
}

function toHostRequest(req: Request): ExpressHostRequest {
  return {
    body: req.body,
    contentType: req.headers['content-type'],
    onClose: (listener) => req.once('close', listener),
  }
}

function toHostResponse(res: Response): ExpressHostResponse {
  return {
    get headersSent() {
      return res.headersSent
    },
    send: (statusCode, body, contentType) => {
      res.status(statusCode)
      if (contentType) res.contentType(contentType)
      if (body === undefined) res.end()
      else res.send(body)
    },
  }
}
