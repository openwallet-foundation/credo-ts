/**
 * Hosts the agent on your Fastify app, next to your own routes, HTTP and WebSockets on one port.
 *
 * Run with `pnpm vite-node ./samples/hosts/fastify.ts`
 */
import { fastifyHost } from '@credo-ts/core/http/fastify'
import fastify from 'fastify'
import { createAgent, logInvitation, port } from './agent'

const app = fastify()

const agent = createAgent(fastifyHost(app))

app.get('/health', async () => ({ status: 'ok' }))

await agent.initialize()
await app.listen({ port })
await logInvitation(agent)
