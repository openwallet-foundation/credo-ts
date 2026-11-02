/**
 * Hosts the agent on your Elysia app on Bun, next to your own routes, HTTP and WebSockets on one port.
 *
 * Run with `pnpm build && bun --conditions=cli ./samples/hosts/elysia.ts`. Bun runs the built packages, as an app would.
 */
import { bunWebSocketHost } from '@credo-ts/core/http/bun'
import { elysiaHost } from '@credo-ts/core/http/elysia'
import { Elysia } from 'elysia'
import { createAgent, logInvitation, port } from './agent'

// Bun's global, without adding @types/bun to this repo
declare const Bun: { serve(options: object): unknown }

const app = new Elysia()
// Elysia compiles its handler when `fetch` is read, so read it per request to include the routes added below
const webSocketHost = bunWebSocketHost({ fetch: (request) => app.fetch(request) })

// Elysia serves HTTP, Bun serves the WebSocket upgrades
const agent = createAgent([elysiaHost(app), webSocketHost])

app.get('/health', () => ({ status: 'ok' }))

await agent.initialize()
Bun.serve({ port, fetch: webSocketHost.fetch, websocket: webSocketHost.websocket })
await logInvitation(agent)
