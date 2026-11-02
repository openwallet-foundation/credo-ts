import type { Server } from 'node:http'
import { Agent } from '@credo-ts/core'
import { getAgentOptions, makeConnection } from '../packages/core/tests/helpers'
import { DidCommMediationState, DidCommWsInboundTransport, DidCommWsOutboundTransport } from '../packages/didcomm/src'
import { closeServers, hostAgent } from './hostAgent'

// FIXME: port numbers should not depend on availability from other test suites that use web sockets
const mediatorPort = 4102

describe('E2E WS session tests', () => {
  let mediatorAgent: Agent
  let recipientAgent: Agent
  const servers: Server[] = []

  afterEach(async () => {
    await recipientAgent?.shutdown()
    await mediatorAgent?.shutdown()
    await closeServers(servers)
  })

  // Connecting sends a trust ping without return routing in between messages that do use return routing.
  // The mediator must not close the socket for it, otherwise the mediate-grant gets queued instead.
  test('mediator keeps the WebSocket open for messages that follow one without return routing', async () => {
    mediatorAgent = new Agent(
      getAgentOptions(
        'E2E WS Session Mediator',
        {
          endpoints: [`ws://localhost:${mediatorPort}`],
          mediator: { autoAcceptMediationRequests: true },
        },
        {},
        {},
        { requireDidcomm: true }
      )
    )
    recipientAgent = new Agent(getAgentOptions('E2E WS Session Recipient', {}, {}, {}, { requireDidcomm: true }))

    const server = hostAgent(mediatorAgent, mediatorPort)
    servers.push(server)
    let openedSocketCount = 0
    server.on('upgrade', () => {
      openedSocketCount++
    })

    mediatorAgent.didcomm.registerInboundTransport(new DidCommWsInboundTransport())
    mediatorAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await mediatorAgent.initialize()

    recipientAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await recipientAgent.initialize()

    const [, recipientMediatorConnection] = await makeConnection(mediatorAgent, recipientAgent)

    const mediationRecord =
      await recipientAgent.didcomm.mediationRecipient.requestAndAwaitGrant(recipientMediatorConnection)
    expect(mediationRecord.state).toBe(DidCommMediationState.Granted)

    expect(openedSocketCount).toBe(1)
  })
})
