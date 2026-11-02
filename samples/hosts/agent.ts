import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, LogLevel } from '@credo-ts/core'
import type { HttpHost } from '@credo-ts/core/http'
import { DidCommModule } from '@credo-ts/didcomm'
import { agentDependencies } from '@credo-ts/node'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'

export const port = process.env.AGENT_PORT ? Number(process.env.AGENT_PORT) : 3001

/**
 * The agent of the host samples. It receives DIDComm messages over HTTP and WebSockets, on the routes its `http` host
 * serves.
 */
export function createAgent(http: HttpHost | HttpHost[]) {
  return new Agent({
    config: { logger: new ConsoleLogger(LogLevel.Info) },
    dependencies: agentDependencies,
    http,
    modules: {
      askar: new AskarModule({
        askar: NativeAskar,
        store: {
          id: `host-sample-${port}`,
          key: 'host-sample',
          database: { type: 'sqlite', config: { inMemory: true } },
        },
      }),
      didcomm: new DidCommModule({
        endpoints: [`http://localhost:${port}`, `ws://localhost:${port}`],
        transports: {
          inbound: { http: true, ws: true },
          outbound: { http: true, ws: true },
        },
        connections: { autoAcceptConnections: true },
      }),
    },
  })
}

export async function logInvitation(agent: ReturnType<typeof createAgent>) {
  const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation({ multiUseInvitation: true })
  agent.config.logger.info(`Invitation: ${outOfBandInvitation.toUrl({ domain: `http://localhost:${port}` })}`)
}
