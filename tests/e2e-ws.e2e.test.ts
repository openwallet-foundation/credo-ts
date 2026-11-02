import type { Server } from 'node:http'
import { Agent } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommMediatorPickupStrategy,
  DidCommWsInboundTransport,
  DidCommWsOutboundTransport,
} from '@credo-ts/didcomm'
import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'
import { e2eTest } from './e2e-test'
import { closeServers, hostAgent } from './hostAgent'

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

const mediatorPort = 4000
const mediatorAgentOptions = getAgentOptions(
  'E2E WS Mediator',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
      extraDidCommConfig: {
        endpoints: [`ws://localhost:${mediatorPort}`],
        mediator: {
          autoAcceptMediationRequests: true,
        },
      },
    }),
  },
  { requireDidcomm: true }
)

const senderPort = 4001
const senderAgentOptions = getAgentOptions(
  'E2E WS Sender',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
      extraDidCommConfig: {
        endpoints: [`ws://localhost:${senderPort}`],
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
  const servers: Server[] = []

  beforeEach(async () => {
    recipientAgent = new Agent(recipientAgentOptions) as unknown as AnonCredsTestsAgent
    mediatorAgent = new Agent(mediatorAgentOptions) as unknown as AnonCredsTestsAgent
    senderAgent = new Agent(senderAgentOptions) as unknown as AnonCredsTestsAgent
    servers.push(hostAgent(mediatorAgent, mediatorPort), hostAgent(senderAgent, senderPort))
  })

  afterEach(async () => {
    await recipientAgent.shutdown()
    await mediatorAgent.shutdown()
    await senderAgent.shutdown()
    await closeServers(servers)
  })

  test('Full WS flow (connect, request mediation, issue, verify)', async () => {
    // Recipient Setup
    recipientAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.didcomm.registerInboundTransport(new DidCommWsInboundTransport())
    mediatorAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.didcomm.registerInboundTransport(new DidCommWsInboundTransport())
    senderAgent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
