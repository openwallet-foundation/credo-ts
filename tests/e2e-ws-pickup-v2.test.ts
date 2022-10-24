import { getAgentOptions } from '../packages/core/tests/helpers'

import { e2eTest } from './e2e-test'

import { Agent, WsOutboundTransport, AutoAcceptCredential, MediatorPickupStrategy } from '@aries-framework/core'
import { WsInboundTransport } from '@aries-framework/node'

const recipientOptions = getAgentOptions('E2E WS Pickup V2 Recipient ', {
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
  mediatorPickupStrategy: MediatorPickupStrategy.PickUpV2,
})

// FIXME: port numbers should not depend on availability from other test suites that use web sockets
const mediatorPort = 4100
const mediatorOptions = getAgentOptions('E2E WS Pickup V2 Mediator', {
  endpoints: [`ws://localhost:${mediatorPort}`],
  autoAcceptMediationRequests: true,
})

const senderPort = 4101
const senderOptions = getAgentOptions('E2E WS Pickup V2 Sender', {
  endpoints: [`ws://localhost:${senderPort}`],
  mediatorPollingInterval: 1000,
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
  mediatorPickupStrategy: MediatorPickupStrategy.PickUpV2,
})

describe('E2E WS Pickup V2 tests', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent
  let senderAgent: Agent

  beforeEach(async () => {
    recipientAgent = new Agent(recipientOptions)
    mediatorAgent = new Agent(mediatorOptions)
    senderAgent = new Agent(senderOptions)
  })

  afterEach(async () => {
    await recipientAgent.shutdown()
    await recipientAgent.wallet.delete()
    await mediatorAgent.shutdown()
    await mediatorAgent.wallet.delete()
    await senderAgent.shutdown()
    await senderAgent.wallet.delete()
  })

  test('Full WS flow (connect, request mediation, issue, verify) using Message Pickup V2', async () => {
    // Recipient Setup
    recipientAgent.registerOutboundTransport(new WsOutboundTransport())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.registerInboundTransport(new WsInboundTransport({ port: mediatorPort }))
    mediatorAgent.registerOutboundTransport(new WsOutboundTransport())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.registerInboundTransport(new WsInboundTransport({ port: senderPort }))
    senderAgent.registerOutboundTransport(new WsOutboundTransport())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})
