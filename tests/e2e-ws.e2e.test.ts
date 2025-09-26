import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'

import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'

import { Agent } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommMediationRecipientModule,
  DidCommMediatorModule,
  DidCommMediatorPickupStrategy,
  DidCommWsOutboundTransport,
} from '@credo-ts/didcomm'
import { DidCommWsInboundTransport } from '@credo-ts/node'

// FIXME: somehow if we use the in memory wallet and storage service in the WS test it will fail,
// but it succeeds with Askar. We should look into this at some point
const recipientAgentOptions = getAgentOptions(
  'E2E WS Recipient ',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
    mediationRecipient: new DidCommMediationRecipientModule({
      mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
    }),
  },
  { requireDidcomm: true }
)

const mediatorPort = 4000
const mediatorAgentOptions = getAgentOptions(
  'E2E WS Mediator',
  {
    endpoints: [`ws://localhost:${mediatorPort}`],
  },
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
    mediator: new DidCommMediatorModule({ autoAcceptMediationRequests: true }),
  },
  { requireDidcomm: true }
)

const senderPort = 4001
const senderAgentOptions = getAgentOptions(
  'E2E WS Sender',
  {
    endpoints: [`ws://localhost:${senderPort}`],
  },
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
    mediationRecipient: new DidCommMediationRecipientModule({
      mediatorPollingInterval: 1000,
      mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
    }),
  },
  { requireDidcomm: true }
)

describe('E2E WS tests', () => {
  let recipientAgent: AnonCredsTestsAgent
  let mediatorAgent: AnonCredsTestsAgent
  let senderAgent: AnonCredsTestsAgent

  beforeEach(async () => {
    recipientAgent = new Agent(recipientAgentOptions) as unknown as AnonCredsTestsAgent
    mediatorAgent = new Agent(mediatorAgentOptions) as unknown as AnonCredsTestsAgent
    senderAgent = new Agent(senderAgentOptions) as unknown as AnonCredsTestsAgent
  })

  afterEach(async () => {
    await recipientAgent.shutdown()
    await mediatorAgent.shutdown()
    await senderAgent.shutdown()
  })

  test('Full WS flow (connect, request mediation, issue, verify)', async () => {
    // Recipient Setup
    recipientAgent.modules.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.modules.didcomm.registerInboundTransport(new DidCommWsInboundTransport({ port: mediatorPort }))
    mediatorAgent.modules.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.modules.didcomm.registerInboundTransport(new DidCommWsInboundTransport({ port: senderPort }))
    senderAgent.modules.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
