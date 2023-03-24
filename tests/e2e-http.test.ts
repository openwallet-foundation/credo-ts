import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/legacyAnonCredsSetup'

import { getLegacyAnonCredsModules } from '../packages/anoncreds/tests/legacyAnonCredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'

import {
  HttpOutboundTransport,
  Agent,
  AutoAcceptCredential,
  MediatorPickupStrategy,
  MediationRecipientModule,
  MediatorModule,
} from '@aries-framework/core'
import { HttpInboundTransport } from '@aries-framework/node'

const recipientAgentOptions = getAgentOptions(
  'E2E HTTP Recipient',
  {},
  {
    ...getLegacyAnonCredsModules({
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    }),
    mediationRecipient: new MediationRecipientModule({
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    }),
  }
)

const mediatorPort = 3000
const mediatorAgentOptions = getAgentOptions(
  'E2E HTTP Mediator',
  {
    endpoints: [`http://localhost:${mediatorPort}`],
  },
  {
    ...getLegacyAnonCredsModules({
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    }),
    mediator: new MediatorModule({
      autoAcceptMediationRequests: true,
    }),
  }
)

const senderPort = 3001
const senderAgentOptions = getAgentOptions(
  'E2E HTTP Sender',
  {
    endpoints: [`http://localhost:${senderPort}`],
  },
  {
    ...getLegacyAnonCredsModules({
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    }),
    mediationRecipient: new MediationRecipientModule({
      mediatorPollingInterval: 1000,
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    }),
  }
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
    await recipientAgent.wallet.delete()
    await mediatorAgent.shutdown()
    await mediatorAgent.wallet.delete()
    await senderAgent.shutdown()
    await senderAgent.wallet.delete()
  })

  test('Full HTTP flow (connect, request mediation, issue, verify)', async () => {
    // Recipient Setup
    recipientAgent.registerOutboundTransport(new HttpOutboundTransport())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.registerInboundTransport(new HttpInboundTransport({ port: mediatorPort }))
    mediatorAgent.registerOutboundTransport(new HttpOutboundTransport())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.registerInboundTransport(new HttpInboundTransport({ port: senderPort }))
    senderAgent.registerOutboundTransport(new HttpOutboundTransport())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
