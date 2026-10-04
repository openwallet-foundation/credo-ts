import { once } from 'node:events'
import { Agent } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommMediatorPickupStrategy,
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
const recipientAgentOptions = getAgentOptions(
  'E2E WS Recipient ',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
      extraDidCommConfig: {
        mediationRecipient: {
          mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
        },
      },
    }),
  },
  { requireDidcomm: true }
)

function boundPort(server: WebSocketServer): number {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('WebSocket server did not bind to a TCP port')
  return address.port
}

const mediatorAgentOptions = (server: WebSocketServer) =>
  getAgentOptions(
    'E2E WS Mediator',
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
          },
        },
      }),
    },
    { requireDidcomm: true }
  )

const senderAgentOptions = (server: WebSocketServer) =>
  getAgentOptions(
    'E2E WS Sender',
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
          mediationRecipient: {
            mediatorPollingInterval: 1000,
            mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
          },
        },
      }),
    },
    { requireDidcomm: true }
  )

describe('E2E WS tests', () => {
  let recipientAgent: AnonCredsTestsAgent
  let mediatorAgent: AnonCredsTestsAgent
  let senderAgent: AnonCredsTestsAgent
  let mediatorServer: WebSocketServer | undefined
  let senderServer: WebSocketServer | undefined

  beforeEach(async () => {
    mediatorServer = new WebSocketServer({ port: 0 })
    senderServer = new WebSocketServer({ port: 0 })
    await Promise.all([once(mediatorServer, 'listening'), once(senderServer, 'listening')])
    recipientAgent = new Agent(recipientAgentOptions) as unknown as AnonCredsTestsAgent
    mediatorAgent = new Agent(mediatorAgentOptions(mediatorServer)) as unknown as AnonCredsTestsAgent
    senderAgent = new Agent(senderAgentOptions(senderServer)) as unknown as AnonCredsTestsAgent
  })

  afterEach(async () => {
    try {
      await recipientAgent?.shutdown()
      await mediatorAgent?.shutdown()
      await senderAgent?.shutdown()
    } finally {
      await Promise.all(
        [mediatorServer, senderServer]
          .filter((server): server is WebSocketServer => server !== undefined)
          .map(
            (server) =>
              new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
          )
      )
    }
  })

  test('Full WS flow (connect, request mediation, issue, verify)', async () => {
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
