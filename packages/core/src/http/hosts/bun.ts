import bunWebSocketAdapter, { type BunAdapter } from 'crossws/adapters/bun'
import type { HttpHost, HttpRouter, WebSocketRoute } from '../HttpRouter'
import { createFetchHandler, createWebSocketResolver } from './host'

type BunServer = Parameters<BunAdapter['handleUpgrade']>[1]
type BunFetch = (request: Request, server: BunServer) => Response | Promise<Response>

export interface BunHost extends HttpHost {
  /** Pass to `Bun.serve` */
  fetch: (request: Request, server: BunServer) => Promise<Response | undefined>
  /** Pass to `Bun.serve` */
  websocket: BunAdapter['websocket']
}

/**
 * Serves the agent's HTTP and WebSocket routes on `Bun.serve`. Pass the `fetch` of your own app, such as Hono, to
 * serve your routes next to the agent's.
 *
 * @example
 * const host = bunHost({ fetch: app.fetch })
 * const agent = new Agent({ ..., http: host })
 * Bun.serve({ port: 3000, fetch: host.fetch, websocket: host.websocket })
 */
export function bunHost(options: { fetch?: BunFetch } = {}): BunHost {
  let fetch: BunFetch = (request, server) => options.fetch?.(request, server) ?? new Response(null, { status: 404 })
  const webSocketHost = bunWebSocketHost({ fetch: (request, server) => fetch(request, server) })

  return {
    ...webSocketHost,
    http: (router: HttpRouter) => {
      fetch = createFetchHandler(router, options.fetch)
    },
  }
}

/**
 * Serves the agent's WebSocket routes on `Bun.serve`, for an app that serves the agent's HTTP routes itself, such as
 * Elysia with `elysiaHost(app)`. Passes all other requests to the `fetch` of your app.
 *
 * @example
 * const host = bunWebSocketHost({ fetch: app.fetch })
 * const agent = new Agent({ ..., http: [elysiaHost(app), host] })
 * Bun.serve({ port: 3000, fetch: host.fetch, websocket: host.websocket })
 */
export function bunWebSocketHost(options: { fetch?: BunFetch } = {}): BunHost {
  let resolveRoute: ((request: Request) => WebSocketRoute | undefined) | undefined
  const adapter = bunWebSocketAdapter({
    resolve: (request) => resolveRoute?.(request) ?? {},
  })

  return {
    webSocket: (agentRouter: HttpRouter) => {
      resolveRoute = createWebSocketResolver(agentRouter)
    },
    websocket: adapter.websocket,
    // Bun answers an upgraded request itself, so this returns nothing for it
    fetch: async (request: Request, server: BunServer): Promise<Response | undefined> => {
      if (request.headers.get('upgrade') === 'websocket' && resolveRoute?.(request)) {
        return adapter.handleUpgrade(request, server)
      }

      return options.fetch?.(request, server) ?? new Response(null, { status: 404 })
    },
  }
}
