import { createServer, type Server } from 'node:http'
import type { HttpRouter } from '@credo-ts/core/http'
import { nodeHost } from '@credo-ts/core/http/node'

/**
 * Hosts the agent's HTTP and WebSocket routes on a new Node.js server listening on `port`.
 */
export function hostAgent(agent: { http: HttpRouter }, port: number) {
  const server = createServer()
  agent.http.addHost(nodeHost(server))
  return server.listen(port)
}

export async function closeServers(servers: Server[]) {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}
