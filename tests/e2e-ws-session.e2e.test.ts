import { Agent } from '@credo-ts/core'
import { DidCommWsInboundTransport } from '@credo-ts/didcomm'
import { webSocketHost } from '@credo-ts/node'
import { WebSocketServer } from 'ws'
import { getAgentOptions, makeConnection } from '../packages/core/tests/helpers'
import { DidCommMediationState, DidCommWsOutboundTransport } from '../packages/didcomm/src'

// FIXME: port numbers should not depend on availability from other test suites that use web sockets
const mediatorPort = 4102

describe('E2E WS session tests', () => {
  let mediatorAgent: Agent
  let recipientAgent: Agent
  let socketServer: WebSocketServer | undefined

  afterEach(async () => {
    await recipientAgent?.shutdown()
    await mediatorAgent?.shutdown()
    // The application owns the WebSocketServer, so the agent does not close it on shutdown
    await new Promise<void>((resolve) => (socketServer ? socketServer.close(() => resolve()) : resolve()))
  })

  // Connecting sends a trust ping without return routing in between messages that do use return routing.
  // The mediator must not close the socket for it, otherwise the mediate-grant gets queued instead.
  test('mediator keeps the WebSocket open for messages that follow one without return routing', async () => {
    socketServer = new WebSocketServer({ port: mediatorPort })
    let openedSocketCount = 0
    socketServer.on('connection', () => {
      openedSocketCount++
    })

    mediatorAgent = new Agent(
      getAgentOptions(
        'E2E WS Session Mediator',
        {
          endpoints: [`ws://localhost:${mediatorPort}`],
          transports: {
            inbound: [new DidCommWsInboundTransport({ host: webSocketHost({ server: socketServer }) })],
          },
          mediator: { autoAcceptMediationRequests: true },
        },
        {},
        {},
        { requireDidcomm: true }
      )
    )
    recipientAgent = new Agent(getAgentOptions('E2E WS Session Recipient', {}, {}, {}, { requireDidcomm: true }))

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
