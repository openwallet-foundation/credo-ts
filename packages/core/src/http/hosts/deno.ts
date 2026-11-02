import denoWebSocketAdapter, { type DenoAdapter } from 'crossws/adapters/deno'
import type { HttpRouter, WebSocketRoute } from '../HttpRouter'
import { createFetchHandler, createWebSocketResolver } from './host'

type DenoServeInfo = Parameters<DenoAdapter['handleUpgrade']>[1]
type DenoFetch = (request: Request, info: DenoServeInfo) => Response | Promise<Response>

/**
 * Serves the agent's HTTP and WebSocket routes on `Deno.serve`. Pass the `fetch` of your own app, such as Hono, to
 * serve your routes next to the agent's.
 *
 * @example
 * const host = denoHost({ fetch: app.fetch })
 * const agent = new Agent({ ..., http: host })
 * Deno.serve({ port: 3000 }, host.fetch)
 */
export function denoHost(options: { fetch?: DenoFetch } = {}) {
  let resolveRoute: ((request: Request) => WebSocketRoute | undefined) | undefined
  let fetch: DenoFetch = (request, info) => options.fetch?.(request, info) ?? new Response(null, { status: 404 })
  const adapter = denoWebSocketAdapter({
    resolve: (request) => resolveRoute?.(request) ?? {},
  })

  return {
    http: (agentRouter: HttpRouter) => {
      fetch = createFetchHandler(agentRouter, options.fetch)
    },
    webSocket: (agentRouter: HttpRouter) => {
      resolveRoute = createWebSocketResolver(agentRouter)
    },
    fetch: (request: Request, info: DenoServeInfo) => {
      if (request.headers.get('upgrade') === 'websocket' && resolveRoute?.(request)) {
        return adapter.handleUpgrade(request, info)
      }

      return fetch(request, info)
    },
  }
}
