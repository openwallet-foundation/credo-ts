import { type App, apply } from '@universal-middleware/h3'
import type { HttpHost } from '../HttpRouter'
import { createUniversalMiddleware } from './host'

/**
 * Serves the agent's HTTP routes on your h3 app, next to your own routes. Add a WebSocket host for your runtime, such
 * as `nodeWebSocketHost(server)` or `bunWebSocketHost()`.
 *
 * @example
 * const app = new H3()
 * const agent = new Agent({ ..., http: h3Host(app) })
 */
export function h3Host(app: App) {
  return { http: (router) => apply(app, [createUniversalMiddleware(router)]) } satisfies HttpHost
}
