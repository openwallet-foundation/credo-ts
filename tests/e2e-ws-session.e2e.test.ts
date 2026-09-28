import { Agent } from '@credo-ts/core'
import { DidCommWsInboundTransport } from '@credo-ts/node'
import { WebSocketServer } from 'ws'
import { getAgentOptions, makeConnection } from '../packages/core/tests/helpers'
import { DidCommMediationState, DidCommWsOutboundTransport } from '../packages/didcomm/src'

// FIXME: port numbers should not depend on availability from other test suites that use web sockets
const mediatorPort = 4102

describe('E2E WS session tests', () => {
  let mediatorAgent: Agent
  let recipientAgent: Agent

  afterEach(async () => {
    await recipientAgent?.shutdown()
    await mediatorAgent?.shutdown()
  })

  // A WebSocket carries every message the recipient sends over it. Connecting and requesting
  // mediation sends a trust ping with `~transport.return_route` set to `none` in between two
  // messages that do use return routing. If the mediator closes the socket for that trust ping,
  // the `mediate-grant` can no longer be returned over it and ends up queued instead, leaving
  // `requestAndAwaitGrant` to time out.
  test('mediator keeps the WebSocket open for messages that follow one without return routing', async () => {
    const socketServer = new WebSocketServer({ port: mediatorPort })
    let openedSocketCount = 0
    socketServer.on('connection', () => {
      openedSocketCount++
    })

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

    mediatorAgent.didcomm.registerInboundTransport(new DidCommWsInboundTransport({ server: socketServer }))
    mediatorAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await mediatorAgent.initialize()

    recipientAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await recipientAgent.initialize()

    const [, recipientMediatorConnection] = await makeConnection(mediatorAgent, recipientAgent)

    const mediationRecord =
      await recipientAgent.didcomm.mediationRecipient.requestAndAwaitGrant(recipientMediatorConnection)
    expect(mediationRecord.state).toBe(DidCommMediationState.Granted)

    // The whole exchange must happen over the single socket the recipient opened. If the mediator
    // closed it in between, the recipient would have had to reconnect.
    expect(openedSocketCount).toBe(1)
  })
})
