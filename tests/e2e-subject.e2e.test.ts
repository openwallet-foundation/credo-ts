import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'
import type { SubjectMessage } from './transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'
import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

import { Agent } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommMediationRecipientModule,
  DidCommMediatorModule,
  DidCommMediatorPickupStrategy,
} from '@credo-ts/didcomm'

const recipientAgentOptions = getAgentOptions(
  'E2E Subject Recipient',
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
const mediatorAgentOptions = getAgentOptions(
  'E2E Subject Mediator',
  {
    endpoints: ['rxjs:mediator'],
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
const senderAgentOptions = getAgentOptions(
  'E2E Subject Sender',
  {
    endpoints: ['rxjs:sender'],
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
    await mediatorAgent.shutdown()
    await senderAgent.shutdown()
  })

  test('Full Subject flow (connect, request mediation, issue, verify)', async () => {
    const mediatorMessages = new Subject<SubjectMessage>()
    const senderMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
      'rxjs:sender': senderMessages,
    }

    // Recipient Setup
    recipientAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    senderAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(senderMessages))
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
