import type { Server } from 'node:http'
import { type App, apply } from '@universal-middleware/fastify'
import type { HttpHost } from '../HttpRouter'
import { createUniversalMiddleware } from './host'
import { nodeWebSocketHost } from './node'

/**
 * Serves the agent's HTTP and WebSocket routes on your Fastify app, next to your own routes. Initialize the agent
 * before `app.listen()`.
 *
 * @example
 * const app = fastify()
 * const agent = new Agent({ ..., http: fastifyHost(app) })
 * await agent.initialize()
 * await app.listen({ port: 3000 })
 */
export function fastifyHost(app: App) {
  return {
    http: (router) => {
      // Fastify rejects content types it has no parser for, such as DIDComm's. Leaving those bodies unparsed lets the
      // agent's routes read them, with their own size limits.
      if (!app.hasContentTypeParser('*')) app.addContentTypeParser('*', (_request, _payload, done) => done(null))

      return apply(app, [createUniversalMiddleware(router)])
    },
    ...nodeWebSocketHost(app.server as Server),
  } satisfies HttpHost
}
