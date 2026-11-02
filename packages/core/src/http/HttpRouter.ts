import { CredoError } from '../error'
import { injectable } from '../plugins'

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export interface HttpRoute {
  method: HttpMethod

  /**
   * Path with optional `:name` params, such as `/oid4vci/:issuerId/credential`.
   */
  path: string

  handler: (request: Request, context: { params: Record<string, string> }) => Response | Promise<Response>
}

export interface WebSocketPeer {
  readonly id: string
  send(data: string): void
  close(code?: number, reason?: string): void
  terminate(): void
}

export interface WebSocketMessage {
  text(): string
}

export interface WebSocketRoute {
  path: string
  open?(peer: WebSocketPeer): void | Promise<void>
  message?(peer: WebSocketPeer, message: WebSocketMessage): void | Promise<void>
  close?(peer: WebSocketPeer): void | Promise<void>
}

/**
 * Hosts the agent's routes on a server, such as `expressHost(app)` from `@credo-ts/core/http/express`. Pass it to the
 * agent's `http` option. A host serves HTTP routes, WebSocket routes, or both.
 */
export interface HttpHost {
  http?(router: HttpRouter): void | Promise<void>
  webSocket?(router: HttpRouter): void | Promise<void>
}

/**
 * Collects the HTTP and WebSocket routes of all modules, so one server hosts the endpoints of DIDComm, OpenID4VC and
 * any other module.
 */
@injectable()
export class HttpRouter {
  // Replaced on every change, so hosts can cache their routing per array
  private _routes: readonly HttpRoute[] = []
  private _webSocketRoutes: readonly WebSocketRoute[] = []
  private hosted = { http: false, webSocket: false }
  private pendingHosts: Promise<unknown>[] = []

  public get routes() {
    return this._routes
  }

  public get webSocketRoutes() {
    return this._webSocketRoutes
  }

  public addRoute(route: HttpRoute) {
    this._routes = [...this._routes, route]
  }

  public removeRoute(route: HttpRoute) {
    this._routes = this._routes.filter((r) => r !== route)
  }

  public addWebSocketRoute(route: WebSocketRoute) {
    this._webSocketRoutes = [...this._webSocketRoutes, route]
  }

  public removeWebSocketRoute(route: WebSocketRoute) {
    this._webSocketRoutes = this._webSocketRoutes.filter((r) => r !== route)
  }

  public addHost(host: HttpHost) {
    for (const kind of ['http', 'webSocket'] as const) {
      const serve = host[kind]
      if (!serve) continue

      this.hosted[kind] = true
      // Kept as a result, so a failing host is reported by assertHosted rather than as an unhandled rejection
      this.pendingHosts.push(
        Promise.resolve(serve.call(host, this)).then(
          () => undefined,
          (error: unknown) => error
        )
      )
    }
  }

  /**
   * Waits for the hosts to be set up, and checks that a host serves each kind of route the modules added.
   */
  public async assertHosted() {
    const hostError = (await Promise.all(this.pendingHosts)).find((error) => error !== undefined)
    if (hostError) throw new CredoError('Setting up an HTTP host failed', { cause: hostError as Error })

    const [route] = this._routes
    if (route && !this.hosted.http) {
      throw new CredoError(
        `The agent has HTTP routes, such as ${route.method} ${route.path}, but no host serves HTTP. Pass a host to the agent's 'http' option.`
      )
    }

    const [webSocketRoute] = this._webSocketRoutes
    if (webSocketRoute && !this.hosted.webSocket) {
      throw new CredoError(
        `The agent has WebSocket routes, such as ${webSocketRoute.path}, but no host serves WebSockets. Pass a host that does to the agent's 'http' option, such as nodeHost(server) or bunHost().`
      )
    }
  }
}
