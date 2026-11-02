import { once } from 'node:events'
import { Agent } from '@credo-ts/core'
import { DidCommMediationState, DidCommWsInboundTransport, DidCommWsOutboundTransport } from '@credo-ts/didcomm'
import { webSocketHost } from '@credo-ts/node/websocket'
import { WebSocketServer } from 'ws'
import { getAgentOptions, makeConnection } from '../packages/core/tests/helpers'

describe('E2E WS session tests', () => {
  let mediatorAgent: Agent
  let recipientAgent: Agent
  let socketServer: WebSocketServer | undefined

  afterEach(async () => {
    try {
      await recipientAgent?.shutdown()
      await mediatorAgent?.shutdown()
    } finally {
      // The application owns the WebSocketServer, so the agent does not close it on shutdown
      const server = socketServer
      if (server) {
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      }
    }
  })

  // Connecting sends a trust ping without return routing in between messages that do use return routing.
  // The mediator must not close the socket for it, otherwise the mediate-grant gets queued instead.
  test('mediator keeps the WebSocket open for messages that follow one without return routing', async () => {
    const server = new WebSocketServer({ port: 0 })
    socketServer = server
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('WebSocket server did not bind to a TCP port')
    let openedSocketCount = 0
    server.on('connection', () => {
      openedSocketCount++
    })

    mediatorAgent = new Agent(
      getAgentOptions(
        'E2E WS Session Mediator',
        {
          endpoints: [`ws://localhost:${address.port}`],
          transports: {
            inbound: [new DidCommWsInboundTransport({ host: webSocketHost({ server }) })],
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
