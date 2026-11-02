/**
 * Hosts the agent on a Node.js server that only serves the agent, HTTP and WebSockets on one port.
 *
 * Run with `pnpm vite-node ./samples/hosts/node.ts`
 */
import { createServer } from 'node:http'
import { nodeHost } from '@credo-ts/core/http/node'
import { createAgent, logInvitation, port } from './agent'

const server = createServer()

const agent = createAgent(nodeHost(server))

await agent.initialize()
server.listen(port)
await logInvitation(agent)
