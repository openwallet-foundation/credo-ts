import { Agent } from '@credo-ts/core'
import {
  DidCommHandshakeProtocol,
  DidCommHttpOutboundTransport,
  DidCommMediatorPickupStrategy,
  InMemoryQueueTransportRepository,
} from '@credo-ts/didcomm'
import { DidCommHttpInboundTransport } from '@credo-ts/node'
import { getAgentOptions, makeConnection } from '../packages/core/tests/helpers'

// Keeps a status request in progress long enough for the next one to arrive
class SlowQueueTransportRepository extends InMemoryQueueTransportRepository {
  public async getAvailableMessageCount(
    ...args: Parameters<InMemoryQueueTransportRepository['getAvailableMessageCount']>
  ) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return super.getAvailableMessageCount(...args)
  }
}

const mediatorPort = 3020
const mediatorOptions = getAgentOptions(
  'E2E HTTP Return Route Mediator',
  {
    endpoints: [`http://localhost:${mediatorPort}`],
    mediator: { autoAcceptMediationRequests: true },
    processDidCommMessagesConcurrently: true,
    queueTransportRepository: new SlowQueueTransportRepository(),
  },
  {},
  {},
  { requireDidcomm: true }
)
const recipientOptions = getAgentOptions(
  'E2E HTTP Return Route Recipient',
  { mediationRecipient: { mediatorPollingInterval: 500 } },
  {},
  {},
  { requireDidcomm: true }
)
const senderPort = 3021
const senderOptions = getAgentOptions(
  'E2E HTTP Return Route Sender',
  { endpoints: [`http://localhost:${senderPort}`] },
  {},
  {},
  { requireDidcomm: true }
)

describe('E2E HTTP return route', () => {
  let recipientAgent: Agent<(typeof recipientOptions)['modules']>
  let mediatorAgent: Agent<(typeof mediatorOptions)['modules']>
  let senderAgent: Agent<(typeof senderOptions)['modules']>

  afterEach(async () => {
    await recipientAgent.shutdown()
    await mediatorAgent.shutdown()
    await senderAgent.shutdown()
  })

  test('answers concurrent requests on one connection each on their own session', async () => {
    mediatorAgent = new Agent(mediatorOptions)
    mediatorAgent.didcomm.registerInboundTransport(new DidCommHttpInboundTransport({ port: mediatorPort }))
    mediatorAgent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport())
    await mediatorAgent.initialize()

    recipientAgent = new Agent(recipientOptions)
    recipientAgent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport())
    await recipientAgent.initialize()

    senderAgent = new Agent(senderOptions)
    senderAgent.didcomm.registerInboundTransport(new DidCommHttpInboundTransport({ port: senderPort }))
    senderAgent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport())
    await senderAgent.initialize()

    const mediatorErrorSpy = vi.spyOn(mediatorAgent.config.logger, 'error')

    const { outOfBandInvitation } = await mediatorAgent.didcomm.oob.createInvitation({
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })
    const { connectionRecord } = await recipientAgent.didcomm.oob.receiveInvitation(outOfBandInvitation, {
      label: 'recipient',
    })
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const connection = await recipientAgent.didcomm.connections.returnWhenIsConnected(connectionRecord!.id)

    const mediationRecord = await recipientAgent.didcomm.mediationRecipient.requestAndAwaitGrant(connection)
    await recipientAgent.didcomm.mediationRecipient.setDefaultMediator(mediationRecord)
    await recipientAgent.didcomm.mediationRecipient.initiateMessagePickup(
      mediationRecord,
      DidCommMediatorPickupStrategy.PickUpV2
    )
    const [, senderConnection] = await makeConnection(recipientAgent, senderAgent)

    // Each status request is its own HTTP request, and its status reply has to come back as the response to it.
    // The forward of the basic message arrives while they are open and must not take one of their responses.
    await Promise.all([
      ...Array.from({ length: 5 }, () =>
        recipientAgent.didcomm.messagePickup.pickupMessages({
          connectionId: connection.id,
          protocolVersion: 'v2',
          awaitCompletion: true,
          awaitCompletionTimeoutMs: 5000,
        })
      ),
      senderAgent.didcomm.basicMessages.sendMessage(senderConnection.id, 'hello'),
    ])

    expect(mediatorErrorSpy).not.toHaveBeenCalled()
  })
})
