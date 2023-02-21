import type { SubjectMessage } from './transport/SubjectInboundTransport'
import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/legacyAnonCredsSetup'

import { Subject } from 'rxjs'

import {
  getAskarAnonCredsIndyModules,
  getLegacyAnonCredsModules,
} from '../packages/anoncreds/tests/legacyAnonCredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'

import { Agent, AutoAcceptCredential, MediatorPickupStrategy } from '@aries-framework/core'

import { e2eTest } from './e2e-test'
import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

const recipientAgentOptions = getAgentOptions(
  'E2E Askar Subject Recipient',
  {
    mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
  },
  getAskarAnonCredsIndyModules({
    autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
  })
)
const mediatorAgentOptions = getAgentOptions(
  'E2E Askar Subject Mediator',
  {
    endpoints: ['rxjs:mediator'],
    autoAcceptMediationRequests: true,
  },
  getAskarAnonCredsIndyModules({
    autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
  })
)
const senderAgentOptions = getAgentOptions(
  'E2E Indy SDK Subject Sender',
  {
    endpoints: ['rxjs:sender'],
    mediatorPollingInterval: 1000,
    mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
  },
  getLegacyAnonCredsModules({
    autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
  })
)

describe.skip('E2E Askar-AnonCredsRS-IndyVDR Subject tests', () => {
  let recipientAgent: AnonCredsTestsAgent
  let mediatorAgent: AnonCredsTestsAgent
  let senderAgent: AnonCredsTestsAgent

  beforeEach(async () => {
    recipientAgent = new Agent(recipientAgentOptions)
    mediatorAgent = new Agent(mediatorAgentOptions)
    senderAgent = new Agent(senderAgentOptions)
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
