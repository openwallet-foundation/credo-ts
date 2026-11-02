import type { Server } from 'node:http'
import { Agent } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommHttpInboundTransport,
  DidCommHttpOutboundTransport,
  DidCommMediatorPickupStrategy,
} from '@credo-ts/didcomm'
import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'
import { e2eTest } from './e2e-test'
import { closeServers, hostAgent } from './hostAgent'

const recipientAgentOptions = getAgentOptions(
  'E2E HTTP Recipient',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
      extraDidCommConfig: {
        mediationRecipient: {
          mediatorPollingInterval: 500,
          mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
        },
      },
    }),
  },
  { requireDidcomm: true }
)

const mediatorPort = 3000
const mediatorAgentOptions = getAgentOptions(
  'E2E HTTP Mediator',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
      extraDidCommConfig: {
        endpoints: [`http://localhost:${mediatorPort}`],
        mediator: {
          autoAcceptMediationRequests: true,
        },
      },
    }),
  },
  { requireDidcomm: true }
)

const senderPort = 3001
const senderAgentOptions = getAgentOptions(
  'E2E HTTP Sender',
  {},
  {},
  getAnonCredsModules({
    autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    extraDidCommConfig: {
      endpoints: [`http://localhost:${senderPort}`],
    },
  }),
  { requireDidcomm: true }
)

describe('E2E HTTP tests', () => {
  let recipientAgent: AnonCredsTestsAgent
  let mediatorAgent: AnonCredsTestsAgent
  let senderAgent: AnonCredsTestsAgent
  const servers: Server[] = []

  beforeEach(async () => {
    recipientAgent = new Agent(recipientAgentOptions) as AnonCredsTestsAgent
    mediatorAgent = new Agent(mediatorAgentOptions) as AnonCredsTestsAgent
    senderAgent = new Agent(senderAgentOptions) as AnonCredsTestsAgent
    servers.push(hostAgent(mediatorAgent, mediatorPort), hostAgent(senderAgent, senderPort))
  })

  afterEach(async () => {
    await recipientAgent.shutdown()
    await mediatorAgent.shutdown()
    await senderAgent.shutdown()
    await closeServers(servers)
  })

  test('Full HTTP flow (connect, request mediation, issue, verify)', async () => {
    // Recipient Setup
    recipientAgent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.didcomm.registerInboundTransport(new DidCommHttpInboundTransport())
    mediatorAgent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.didcomm.registerInboundTransport(new DidCommHttpInboundTransport())
    senderAgent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
