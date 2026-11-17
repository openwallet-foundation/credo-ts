/**
 * Connects to a server sample over DIDComm and sends it a basic message. Run it against either server:
 * `pnpm express` or `pnpm nextjs`, then `pnpm client:didcomm`.
 */

import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, CredoError, LogLevel } from '@credo-ts/core'
import { DidCommHttpOutboundTransport, DidCommModule } from '@credo-ts/didcomm'
import { agentDependencies, DidCommHttpInboundTransport } from '@credo-ts/node'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3004'
const port = 3005

const agent = new Agent({
  config: { logger: new ConsoleLogger(LogLevel.Warn) },
  dependencies: agentDependencies,
  modules: {
    askar: new AskarModule({
      askar: NativeAskar,
      store: { id: 'client', key: 'client', database: { type: 'sqlite', config: { inMemory: true } } },
    }),
    didcomm: new DidCommModule({
      endpoints: [`http://localhost:${port}`],
      transports: {
        inbound: [new DidCommHttpInboundTransport({ port })],
        outbound: [new DidCommHttpOutboundTransport()],
      },
      connections: { autoAcceptConnections: true },
    }),
  },
})

await agent.initialize()

const invitationUrl = await (await fetch(`${serverUrl}/invitation`)).text()
const { connectionRecord } = await agent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'client' })
if (!connectionRecord) throw new CredoError('No connection was created for the invitation')
await agent.didcomm.connections.returnWhenIsConnected(connectionRecord.id)
console.log('client: connected')

const start = Date.now()
await agent.didcomm.basicMessages.sendMessage(connectionRecord.id, 'Hello from the client')
console.log(`client: the server responded to the basic message after ${Date.now() - start}ms`)

await agent.shutdown()
