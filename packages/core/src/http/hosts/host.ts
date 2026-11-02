import { createMatcher, enhance, params, pipeRoute, type UniversalMiddleware } from '@universal-middleware/core'
import type { HttpRoute, HttpRouter, WebSocketRoute } from '../HttpRouter'

const middlewares = new WeakMap<readonly HttpRoute[], UniversalMiddleware>()
const webSocketMatchers = new WeakMap<
  readonly WebSocketRoute[],
  Array<[(request: Request) => boolean, WebSocketRoute]>
>()

/**
 * The agent's HTTP routes as one universal middleware (https://universal-middleware.dev), for a server Credo has no
 * host for. Answers the requests that match a route and passes the others on. Create it before `agent.initialize()`.
 *
 * @example apply(app, [createUniversalMiddleware(agent.http)])
 */
export function createUniversalMiddleware(router: HttpRouter): UniversalMiddleware {
  router.addHost({ http: () => {} })

  return (request, context, runtime) => {
    // Routes are looked up per request, so modules can add them after the host is set up
    let middleware = middlewares.get(router.routes)
    if (!middleware) {
      middleware = pipeRoute(router.routes.map(toUniversalHandler))
      middlewares.set(router.routes, middleware)
    }

    return middleware(request, context, runtime)
  }
}

/**
 * The agent's HTTP routes as a fetch handler, for a fetch-based server Credo has no host for. Answers the requests no
 * route matches with `fallback`, or 404. Create it before `agent.initialize()`.
 *
 * @example serve({ fetch: createFetchHandler(agent.http, app.fetch) })
 */
export function createFetchHandler<Args extends unknown[]>(
  router: HttpRouter,
  fallback?: (request: Request, ...args: Args) => Response | Promise<Response>
) {
  const middleware = createUniversalMiddleware(router)

  return async (request: Request, ...args: Args): Promise<Response> => {
    // A new runtime per request, as the router writes the route params to it
    const response = await middleware(request, {}, { runtime: 'other', adapter: 'other', params: undefined })
    if (response instanceof Response) return response
    return fallback ? fallback(request, ...args) : new Response(null, { status: 404 })
  }
}

/**
 * Finds the agent's WebSocket route for an upgrade request, for a crossws adapter (https://crossws.h3.dev) Credo has no
 * host for. Its routes are crossws hooks. Create it before `agent.initialize()`.
 *
 * @example const ws = crossws({ resolve: createWebSocketResolver(agent.http) })
 */
export function createWebSocketResolver(router: HttpRouter) {
  router.addHost({ webSocket: () => {} })

  return (request: Request): WebSocketRoute | undefined => {
    let matchers = webSocketMatchers.get(router.webSocketRoutes)
    if (!matchers) {
      matchers = router.webSocketRoutes.map((route) => [createMatcher(route.path, 'GET'), route])
      webSocketMatchers.set(router.webSocketRoutes, matchers)
    }

    return matchers.find(([matches]) => matches(request))?.[1]
  }
}

function toUniversalHandler(route: HttpRoute) {
  return enhance(
    (request: Request, _context: Universal.Context, runtime: Parameters<typeof params>[1]) =>
      route.handler(request, { params: params(request, runtime, route.path) ?? {} }),
    { method: route.method, path: route.path }
  )
}
