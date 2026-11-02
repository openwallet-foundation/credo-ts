import type { Server } from 'node:http'
import { type App, apply } from '@universal-middleware/express'
import type { HttpHost } from '../HttpRouter'
import { createUniversalMiddleware } from './host'
import { nodeWebSocketHost } from './node'

/**
 * Serves the agent's routes on your Express app, next to your own routes. Pass the app's `server` to also serve the
 * agent's WebSocket routes.
 *
 * @example
 * const app = express()
 * const server = createServer(app)
 * const agent = new Agent({ ..., http: expressHost(app, { server }) })
 * server.listen(3000)
 */
export function expressHost(app: App, options: { server?: Server } = {}) {
  return {
    http: (router) => apply(app, [createUniversalMiddleware(router)]),
    ...(options.server ? nodeWebSocketHost(options.server) : {}),
  } satisfies HttpHost
}
