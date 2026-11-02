/**
 * Hosts the agent on your Hono app on Node.js, next to your own routes, HTTP and WebSockets on one port.
 *
 * Run with `pnpm vite-node ./samples/hosts/hono.ts`
 */

import { createServer } from 'node:http'
import { honoHost } from '@credo-ts/core/http/hono'
import { nodeWebSocketHost } from '@credo-ts/core/http/node'
import { getRequestListener } from '@hono/node-server'
import { Hono } from 'hono'
import { createAgent, logInvitation, port } from './agent'

const app = new Hono()
const server = createServer(getRequestListener(app.fetch))

// Hono serves HTTP, the Node.js server serves the WebSocket upgrades
const agent = createAgent([honoHost(app), nodeWebSocketHost(server)])

app.get('/health', (c) => c.json({ status: 'ok' }))

await agent.initialize()
server.listen(port)
await logInvitation(agent)
