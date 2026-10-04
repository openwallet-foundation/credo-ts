import { once } from 'node:events'
import { Agent } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommMediatorPickupStrategy,
  DidCommMessageForwardingStrategy,
  DidCommWsInboundTransport,
  DidCommWsOutboundTransport,
} from '@credo-ts/didcomm'
import { webSocketHost } from '@credo-ts/node/websocket'
import { WebSocketServer } from 'ws'
import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'
import { e2eTest } from './e2e-test'

// FIXME: somehow if we use the in memory wallet and storage service in the WS test it will fail,
// but it succeeds with Askar. We should look into this at some point

function boundPort(server: WebSocketServer): number {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('WebSocket server did not bind to a TCP port')
  return address.port
}

const mediatorOptions = (server: WebSocketServer) =>
  getAgentOptions(
    'E2E WS Pickup V2 Mediator',
    {},
    {},
    {
      ...getAnonCredsModules({
        autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
        extraDidCommConfig: {
          endpoints: [`ws://localhost:${boundPort(server)}`],
          transports: {
            inbound: [new DidCommWsInboundTransport({ host: webSocketHost({ server }) })],
          },
          mediator: {
            autoAcceptMediationRequests: true,
            messageForwardingStrategy: DidCommMessageForwardingStrategy.QueueAndLiveModeDelivery,
          },
        },
      }),
    },
    { requireDidcomm: true }
  )

const senderOptions = (server: WebSocketServer) =>
  getAgentOptions(
    'E2E WS Pickup V2 Sender',
    {},
    {},
    {
      ...getAnonCredsModules({
        autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
        extraDidCommConfig: {
          endpoints: [`ws://localhost:${boundPort(server)}`],
          transports: {
            inbound: [new DidCommWsInboundTransport({ host: webSocketHost({ server }) })],
          },
        },
      }),
    },
    { requireDidcomm: true }
  )

describe('E2E WS Pickup V2 tests', () => {
  let recipientAgent: AnonCredsTestsAgent
  let mediatorAgent: AnonCredsTestsAgent
  let senderAgent: AnonCredsTestsAgent
  let mediatorServer: WebSocketServer
  let senderServer: WebSocketServer

  beforeEach(async () => {
    mediatorServer = new WebSocketServer({ port: 0 })
    senderServer = new WebSocketServer({ port: 0 })
    await Promise.all([once(mediatorServer, 'listening'), once(senderServer, 'listening')])
    mediatorAgent = new Agent(mediatorOptions(mediatorServer)) as unknown as AnonCredsTestsAgent
    senderAgent = new Agent(senderOptions(senderServer)) as unknown as AnonCredsTestsAgent
  })

  afterEach(async () => {
    // NOTE: the order is important here, as the recipient sends pickup messages to the mediator
    // so we first want the recipient to fully be finished with the sending of messages
    try {
      await recipientAgent?.shutdown()
      await mediatorAgent?.shutdown()
      await senderAgent?.shutdown()
    } finally {
      await Promise.all(
        [mediatorServer, senderServer]
          .filter((server) => server)
          .map(
            (server) =>
              new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
          )
      )
    }
  })

  test('Full WS flow (connect, request mediation, issue, verify) using Message Pickup V2 polling mode', async () => {
    const recipientOptions = getAgentOptions(
      'E2E WS Pickup V2 Recipient polling mode',
      {},
      {},
      {
        ...getAnonCredsModules({
          autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
          extraDidCommConfig: {
            mediationRecipient: {
              mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV2,
              mediatorPollingInterval: 500,
            },
          },
        }),
      },
      { requireDidcomm: true }
    )

    recipientAgent = new Agent(recipientOptions) as unknown as AnonCredsTestsAgent

    // Recipient Setup
    recipientAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })

  test('Full WS flow (connect, request mediation, issue, verify) using Message Pickup V2 live mode', async () => {
    const recipientOptions = getAgentOptions(
      'E2E WS Pickup V2 Recipient live mode',
      {},
      {},
      {
        ...getAnonCredsModules({
          autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
          extraDidCommConfig: {
            mediationRecipient: {
              mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV2LiveMode,
            },
          },
        }),
      },
      { requireDidcomm: true }
    )

    recipientAgent = new Agent(recipientOptions) as unknown as AnonCredsTestsAgent

    // Recipient Setup
    recipientAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
