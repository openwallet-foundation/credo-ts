import type { Express, Request, Response } from 'express'
import express, { text } from 'express'
import type { Server } from 'http'

/**
 * A route served by {@link ExpressHost}. Satisfied structurally by the DIDComm HTTP inbound transport.
 */
export interface ExpressHostBinding {
  readonly path: string
  readonly contentTypes: string[]
  readonly maxBodyBytes: number
  handle(request: ExpressHostRequest, response: ExpressHostResponse): Promise<void>
}

export interface ExpressHostRequest {
  readonly body?: string
  readonly contentType?: string
  onClose(listener: () => void): void
}

export interface ExpressHostResponse {
  readonly headersSent: boolean
  send(statusCode: number, body?: string, contentType?: string): void
}

export type ExpressHostOptions = { app: Express; port?: undefined } | { app?: Express; port: number }

/**
 * Serves DIDComm HTTP inbound routes on an Express application.
 *
 * When `port` is provided the host starts listening when a route is attached, and closes the
 * listener when the route is detached. When only `app` is provided the application owns the listener.
 */
export class ExpressHost {
  public readonly app: Express
  private port?: number
  private _server?: Server

  public get server() {
    return this._server
  }

  public constructor({ app, port }: ExpressHostOptions) {
    this.port = port

    // Use the caller-provided Express app, or create one
    this.app = app ?? express()
  }

  public async attach(binding: ExpressHostBinding): Promise<void> {
    this.app.post(binding.path, text({ type: binding.contentTypes, limit: binding.maxBodyBytes }), (req, res) =>
      binding.handle(toHostRequest(req), toHostResponse(res))
    )

    if (this.port === undefined) {
      return
    }

    const server = this.app.listen(this.port)
    this._server = server

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
  }

  public async detach(_binding: ExpressHostBinding): Promise<void> {
    if (!this._server) {
      return
    }

    return new Promise((resolve, reject) => this._server?.close((err) => (err ? reject(err) : resolve())))
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
