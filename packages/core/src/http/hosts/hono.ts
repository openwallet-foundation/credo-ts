import { type App, apply } from '@universal-middleware/hono'
import type { HttpHost } from '../HttpRouter'
import { createUniversalMiddleware } from './host'

/**
 * Serves the agent's HTTP routes on your Hono app, next to your own routes. Add a WebSocket host for your runtime,
 * such as `nodeWebSocketHost(server)` or `bunWebSocketHost()`.
 *
 * @example
 * const app = new Hono()
 * const agent = new Agent({ ..., http: honoHost(app) })
 */
export function honoHost(app: App) {
  return { http: (router) => apply(app, [createUniversalMiddleware(router)]) } satisfies HttpHost
}
