import type { IncomingMessage, Server } from 'node:http'
import { createRequestAdapter, sendResponse } from '@universal-middleware/node'
import nodeWebSocketAdapter from 'crossws/adapters/node'
import type { HttpHost, HttpRouter } from '../HttpRouter'
import { createFetchHandler, createWebSocketResolver } from './host'

/**
 * Serves the agent's HTTP and WebSocket routes on a Node.js server that only serves the agent.
 *
 * @example
 * const server = createServer()
 * const agent = new Agent({ ..., http: nodeHost(server) })
 * server.listen(3000)
 */
export function nodeHost(server: Server) {
  return {
    http: (router) => {
      const toRequest = createRequestAdapter()
      const fetch = createFetchHandler(router)

      server.on('request', async (request, response) => {
        try {
          await sendResponse(await fetch(toRequest(request, response)), response)
        } catch {
          if (!response.headersSent) response.statusCode = 500
          response.end()
        }
      })
    },
    ...nodeWebSocketHost(server),
  } satisfies HttpHost
}

/**
 * Serves the agent's WebSocket routes on a Node.js server, such as the server of your Hono or h3 app. Upgrades for
 * other paths are left to the server's other `upgrade` listeners.
 */
export function nodeWebSocketHost(server: Server) {
  return {
    webSocket: (router: HttpRouter) => {
      const resolveRoute = createWebSocketResolver(router)
      const adapter = nodeWebSocketAdapter({
        resolve: (request) => resolveRoute(request) ?? {},
        // Same limit as DIDComm HTTP bodies, larger messages close the socket with 1009
        serverOptions: { maxPayload: 5 * 1024 * 1024 },
      })

      server.on('upgrade', (request: IncomingMessage, socket, head) => {
        const webRequest = toUpgradeRequest(request)
        if (!resolveRoute(webRequest)) return

        adapter.handleUpgrade(request, socket, head, webRequest)
      })
    },
  } satisfies HttpHost
}

function toUpgradeRequest(request: IncomingMessage): Request {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  }

  return new Request(new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`), {
    method: request.method,
    headers,
    // The global Request type is React Native's in this monorepo, the constructor is undici's
  }) as Request
}
