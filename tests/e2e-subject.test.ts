import type { SubjectMessage } from './transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { getBaseConfig } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'
import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

import { Agent, AutoAcceptCredential } from '@aries-framework/core'

const recipientConfig = getBaseConfig('E2E Subject Recipient', {
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})
const mediatorConfig = getBaseConfig('E2E Subject Mediator', {
  endpoints: ['rxjs:mediator'],
  autoAcceptMediationRequests: true,
})
const senderConfig = getBaseConfig('E2E Subject Sender', {
  endpoints: ['rxjs:sender'],
  mediatorPollingInterval: 1000,
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})

describe('E2E Subject tests', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent
  let senderAgent: Agent

  beforeEach(async () => {
    recipientAgent = new Agent(recipientConfig.config, recipientConfig.agentDependencies)
    mediatorAgent = new Agent(mediatorConfig.config, mediatorConfig.agentDependencies)
    senderAgent = new Agent(senderConfig.config, senderConfig.agentDependencies)
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
    const recipientMessages = new Subject<SubjectMessage>()
    const senderMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
      'rxjs:sender': senderMessages,
    }

    // Recipient Setup
    recipientAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    recipientAgent.registerInboundTransport(new SubjectInboundTransport(recipientMessages))
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
