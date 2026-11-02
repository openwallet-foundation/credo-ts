import cloudflareWebSocketAdapter, { type CloudflareDurableAdapter } from 'crossws/adapters/cloudflare'
import type { HttpHost, WebSocketRoute } from '../HttpRouter'
import { createFetchHandler, createWebSocketResolver } from './host'

type DurableObject = Parameters<CloudflareDurableAdapter['handleDurableUpgrade']>[0]
type DurableWebSocket = Parameters<CloudflareDurableAdapter['handleDurableMessage']>[1]
type Fetch = (request: Request) => Response | Promise<Response>

export interface CloudflareHost extends HttpHost {
  /** Use as the Durable Object's `fetch` */
  fetch: (request: Request) => Promise<Response>
  /** Use as the Durable Object's `webSocketMessage` */
  webSocketMessage: (webSocket: DurableWebSocket, message: ArrayBuffer | string) => Promise<void>
  /** Use as the Durable Object's `webSocketClose` */
  webSocketClose: (webSocket: DurableWebSocket, code: number, reason: string, wasClean: boolean) => Promise<void>
}

/**
 * Serves the agent's HTTP and WebSocket routes from the Cloudflare Durable Object that runs the agent. WebSockets use
 * the hibernation API, so the Durable Object can sleep between messages. Pass the `fetch` of your own app, such as
 * Hono, to serve your routes next to the agent's.
 *
 * @example
 * export class Agent {
 *   host = cloudflareHost(this, { fetch: app.fetch })
 *   agent = new Agent({ ..., http: this.host })
 *   fetch = this.host.fetch
 *   webSocketMessage = this.host.webSocketMessage
 *   webSocketClose = this.host.webSocketClose
 * }
 */
export function cloudflareHost(durableObject: object, options: { fetch?: Fetch } = {}): CloudflareHost {
  let resolveRoute: ((request: Request) => WebSocketRoute | undefined) | undefined
  let fetch: Fetch = (request) => options.fetch?.(request) ?? new Response(null, { status: 404 })
  const adapter = cloudflareWebSocketAdapter({
    resolve: (request) => resolveRoute?.(request) ?? {},
    // The agent runs in this Durable Object, so upgrades are handled here rather than forwarded to another one
    resolveDurableStub: () => undefined,
  })

  return {
    http: (agentRouter) => {
      fetch = createFetchHandler(agentRouter, options.fetch)
    },
    webSocket: (agentRouter) => {
      resolveRoute = createWebSocketResolver(agentRouter)
    },
    fetch: async (request) => {
      if (request.headers.get('upgrade') === 'websocket' && resolveRoute?.(request)) {
        return adapter.handleDurableUpgrade(durableObject as DurableObject, request)
      }

      return fetch(request)
    },
    webSocketMessage: (webSocket, message) =>
      adapter.handleDurableMessage(durableObject as DurableObject, webSocket, message),
    webSocketClose: (webSocket, code, reason, wasClean) =>
      adapter.handleDurableClose(durableObject as DurableObject, webSocket, code, reason, wasClean),
  }
}
