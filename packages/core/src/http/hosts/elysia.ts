import { type App, apply } from '@universal-middleware/elysia'
import type { HttpHost } from '../HttpRouter'
import { createUniversalMiddleware } from './host'

/**
 * Serves the agent's HTTP routes on your Elysia app, next to your own routes. Add a WebSocket host for your runtime,
 * such as `bunWebSocketHost()`.
 *
 * @example
 * const app = new Elysia()
 * const agent = new Agent({ ..., http: elysiaHost(app) })
 */
export function elysiaHost(app: App) {
  return { http: (router) => apply(app, [createUniversalMiddleware(router)]) } satisfies HttpHost
}
