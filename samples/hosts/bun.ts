/**
 * Hosts the agent on `Bun.serve`, next to the routes of your Hono app, HTTP and WebSockets on one port.
 *
 * Run with `pnpm build && bun --conditions=cli ./samples/hosts/bun.ts`. Bun runs the built packages, as an app would.
 */
import { bunHost } from '@credo-ts/core/http/bun'
import { Hono } from 'hono'
import { createAgent, logInvitation, port } from './agent'

// Bun's global, without adding @types/bun to this repo
declare const Bun: { serve(options: object): unknown }

const app = new Hono()
const host = bunHost({ fetch: app.fetch })

const agent = createAgent(host)

app.get('/health', (c) => c.json({ status: 'ok' }))

await agent.initialize()
Bun.serve({ port, fetch: host.fetch, websocket: host.websocket })
await logInvitation(agent)
