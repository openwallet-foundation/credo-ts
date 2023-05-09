import type { SubjectMessage } from './transport/SubjectInboundTransport'
import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/legacyAnonCredsSetup'

import { Subject } from 'rxjs'

import { getLegacyAnonCredsModules } from '../packages/anoncreds/tests/legacyAnonCredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'
import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

import {
  Agent,
  AutoAcceptCredential,
  MediatorModule,
  MediatorPickupStrategy,
  MediationRecipientModule,
} from '@aries-framework/core'

const recipientAgentOptions = getAgentOptions(
  'E2E Subject Recipient',
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
const mediatorAgentOptions = getAgentOptions(
  'E2E Subject Mediator',
  {
    endpoints: ['rxjs:mediator'],
  },
  {
    ...getLegacyAnonCredsModules({
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    }),
    mediator: new MediatorModule({ autoAcceptMediationRequests: true }),
  }
)
const senderAgentOptions = getAgentOptions(
  'E2E Subject Sender',
  {
    endpoints: ['rxjs:sender'],
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

describe('E2E Subject tests', () => {
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

  test('Full Subject flow (connect, request mediation, issue, verify)', async () => {
    const mediatorMessages = new Subject<SubjectMessage>()
    const senderMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
      'rxjs:sender': senderMessages,
    }

    // Recipient Setup
    recipientAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    senderAgent.registerInboundTransport(new SubjectInboundTransport(senderMessages))
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
