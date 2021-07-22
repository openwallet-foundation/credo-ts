import type { SubjectMessage } from './transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { getBaseConfig } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'
import { SubjectInboundTransporter } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransporter } from './transport/SubjectOutboundTransport'

import { Agent, AutoAcceptCredential } from '@aries-framework/core'

const recipientConfig = getBaseConfig('E2E Subject Recipient', {
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})
const mediatorConfig = getBaseConfig('E2E Subject Mediator', {
  endpoint: 'rxjs:mediator',
  autoAcceptMediationRequests: true,
})
const senderConfig = getBaseConfig('E2E Subject Sender', {
  endpoint: 'rxjs:sender',
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
    await recipientAgent.shutdown({ deleteWallet: true })
    await mediatorAgent.shutdown({ deleteWallet: true })
    await senderAgent.shutdown({ deleteWallet: true })
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
    recipientAgent.setOutboundTransporter(new SubjectOutboundTransporter(recipientMessages, subjectMap))
    recipientAgent.setInboundTransporter(new SubjectInboundTransporter(recipientMessages))
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.setOutboundTransporter(new SubjectOutboundTransporter(mediatorMessages, subjectMap))
    mediatorAgent.setInboundTransporter(new SubjectInboundTransporter(mediatorMessages))
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.setOutboundTransporter(new SubjectOutboundTransporter(senderMessages, subjectMap))
    senderAgent.setInboundTransporter(new SubjectInboundTransporter(senderMessages))
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
