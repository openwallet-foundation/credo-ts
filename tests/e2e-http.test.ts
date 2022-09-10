import { getAgentOptions } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'

import { HttpOutboundTransport, Agent, AutoAcceptCredential, MediatorPickupStrategy } from '@aries-framework/core'
import { HttpInboundTransport } from '@aries-framework/node'

const recipientAgentOptions = getAgentOptions('E2E HTTP Recipient', {
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
  mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
})

const mediatorPort = 3000
const mediatorAgentOptions = getAgentOptions('E2E HTTP Mediator', {
  endpoints: [`http://localhost:${mediatorPort}`],
  autoAcceptMediationRequests: true,
})

const senderPort = 3001
const senderAgentOptions = getAgentOptions('E2E HTTP Sender', {
  endpoints: [`http://localhost:${senderPort}`],
  mediatorPollingInterval: 1000,
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
  mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
})

describe('E2E HTTP tests', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent
  let senderAgent: Agent

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
