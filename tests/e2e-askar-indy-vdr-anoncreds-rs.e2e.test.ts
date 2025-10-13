import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'
import type { SubjectMessage } from './transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'
import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

import { Agent } from '@credo-ts/core'
import { DidCommAutoAcceptCredential, DidCommMediatorPickupStrategy } from '@credo-ts/didcomm'

const recipientAgentOptions = getAgentOptions(
  'E2E Askar Subject Recipient',
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
const mediatorAgentOptions = getAgentOptions(
  'E2E Askar Subject Mediator',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
      extraDidCommConfig: {
        endpoints: ['rxjs:mediator'],
        mediator: {
          autoAcceptMediationRequests: true,
        },
      },
    }),
  },
  { requireDidcomm: true }
)
const senderAgentOptions = getAgentOptions(
  'E2E Askar Subject Sender',
  {},
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
      extraDidCommConfig: {
        endpoints: ['rxjs:sender'],
        mediationRecipient: {
          mediatorPollingInterval: 1000,
          mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
        },
      },
    }),
  },
  { requireDidcomm: true }
)

describe('E2E Askar-AnonCredsRS-IndyVDR Subject tests', () => {
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

  test('Full Subject flow (connect, request mediation, issue, verify)', async () => {
    const mediatorMessages = new Subject<SubjectMessage>()
    const senderMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
      'rxjs:sender': senderMessages,
    }

    // Recipient Setup
    recipientAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    senderAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(senderMessages))
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
