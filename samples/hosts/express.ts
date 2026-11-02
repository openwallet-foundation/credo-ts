/**
 * Hosts the agent on your Express app, next to your own routes, HTTP and WebSockets on one port.
 *
 * Run with `pnpm vite-node ./samples/hosts/express.ts`
 */
import { createServer } from 'node:http'
import { expressHost } from '@credo-ts/core/http/express'
import express from 'express'
import { createAgent, logInvitation, port } from './agent'

const app = express()
const server = createServer(app)

const agent = createAgent(expressHost(app, { server }))

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' })
})

await agent.initialize()
server.listen(port)
await logInvitation(agent)
