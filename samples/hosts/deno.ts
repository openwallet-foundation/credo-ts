/**
 * Hosts the agent on `Deno.serve`, next to the routes of your Hono app, HTTP and WebSockets on one port.
 *
 * Run with `pnpm build && deno run -A --conditions=cli ./samples/hosts/deno.ts`. Deno runs the built packages, as an
 * app would.
 */
import { denoHost } from '@credo-ts/core/http/deno'
import { Hono } from 'hono'
import { createAgent, logInvitation, port } from './agent'

// Deno's global, without adding Deno types to this repo
declare const Deno: { serve(options: { port: number }, handler: unknown): unknown }

const app = new Hono()
const host = denoHost({ fetch: app.fetch })

const agent = createAgent(host)

app.get('/health', (c) => c.json({ status: 'ok' }))

await agent.initialize()
Deno.serve({ port }, host.fetch)
await logInvitation(agent)
