/**
 * Hosts the agent on your h3 app on Node.js, next to your own routes, HTTP and WebSockets on one port.
 *
 * Run with `pnpm vite-node ./samples/hosts/h3.ts`
 */
import { createServer } from 'node:http'
import { h3Host } from '@credo-ts/core/http/h3'
import { nodeWebSocketHost } from '@credo-ts/core/http/node'
import { H3, toNodeHandler } from 'h3'
import { createAgent, logInvitation, port } from './agent'

const app = new H3()
const server = createServer(toNodeHandler(app))

// h3 serves HTTP, the Node.js server serves the WebSocket upgrades
const agent = createAgent([h3Host(app), nodeWebSocketHost(server)])

app.get('/health', () => ({ status: 'ok' }))

await agent.initialize()
server.listen(port)
await logInvitation(agent)
