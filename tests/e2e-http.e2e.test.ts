import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'

import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'

import { Agent } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  HttpOutboundDidCommTransport,
  DidCommMediationRecipientModule,
  DidCommMediatorModule,
  DidCommMediatorPickupStrategy,
} from '@credo-ts/didcomm'
import { HttpInboundDidCommTransport } from '@credo-ts/node'

const recipientAgentOptions = getAgentOptions(
  'E2E HTTP Recipient',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
    mediationRecipient: new DidCommMediationRecipientModule({
      mediatorPollingInterval: 500,
      mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
    }),
  },
  { requireDidcomm: true }
)

const mediatorPort = 3000
const mediatorAgentOptions = getAgentOptions(
  'E2E HTTP Mediator',
  {
    endpoints: [`http://localhost:${mediatorPort}`],
  },
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
    mediator: new DidCommMediatorModule({
      autoAcceptMediationRequests: true,
    }),
  },
  { requireDidcomm: true }
)

const senderPort = 3001
const senderAgentOptions = getAgentOptions(
  'E2E HTTP Sender',
  {
    endpoints: [`http://localhost:${senderPort}`],
  },
  {},
  getAnonCredsModules({
    autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
  }),
  { requireDidcomm: true }
)

describe('E2E HTTP tests', () => {
  let recipientAgent: AnonCredsTestsAgent
  let mediatorAgent: AnonCredsTestsAgent
  let senderAgent: AnonCredsTestsAgent

  beforeEach(async () => {
    recipientAgent = new Agent(recipientAgentOptions) as AnonCredsTestsAgent
    mediatorAgent = new Agent(mediatorAgentOptions) as AnonCredsTestsAgent
    senderAgent = new Agent(senderAgentOptions) as AnonCredsTestsAgent
  })

  afterEach(async () => {
    await recipientAgent.shutdown()
    await mediatorAgent.shutdown()
    await senderAgent.shutdown()
  })

  test('Full HTTP flow (connect, request mediation, issue, verify)', async () => {
    // Recipient Setup
    recipientAgent.modules.didcomm.registerOutboundTransport(new HttpOutboundDidCommTransport())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.modules.didcomm.registerInboundTransport(new HttpInboundDidCommTransport({ port: mediatorPort }))
    mediatorAgent.modules.didcomm.registerOutboundTransport(new HttpOutboundDidCommTransport())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.modules.didcomm.registerInboundTransport(new HttpInboundDidCommTransport({ port: senderPort }))
    senderAgent.modules.didcomm.registerOutboundTransport(new HttpOutboundDidCommTransport())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
