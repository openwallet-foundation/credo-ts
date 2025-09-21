import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'

import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions } from '../packages/core/tests/helpers'
import {
  DidCommAutoAcceptCredential,
  DidCommMediationRecipientModule,
  DidCommMediatorModule,
  DidCommMediatorPickupStrategy,
  DidCommMessageForwardingStrategy,
  DidCommWsOutboundTransport,
} from '../packages/didcomm/src'

import { e2eTest } from './e2e-test'

import { Agent } from '@credo-ts/core'
import { DidCommWsInboundTransport } from '@credo-ts/node'

// FIXME: somehow if we use the in memory wallet and storage service in the WS test it will fail,
// but it succeeds with Askar. We should look into this at some point

// FIXME: port numbers should not depend on availability from other test suites that use web sockets
const mediatorPort = 4100
const mediatorOptions = getAgentOptions(
  'E2E WS Pickup V2 Mediator',
  {
    endpoints: [`ws://localhost:${mediatorPort}`],
  },
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
    mediator: new DidCommMediatorModule({
      autoAcceptMediationRequests: true,
      messageForwardingStrategy: DidCommMessageForwardingStrategy.QueueAndLiveModeDelivery,
    }),
  },
  { requireDidcomm: true }
)

const senderPort = 4101
const senderOptions = getAgentOptions(
  'E2E WS Pickup V2 Sender',
  {
    endpoints: [`ws://localhost:${senderPort}`],
  },
  {},
  {
    ...getAnonCredsModules({
      autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
    }),
  },
  { requireDidcomm: true }
)

describe('E2E WS Pickup V2 tests', () => {
  let recipientAgent: AnonCredsTestsAgent
  let mediatorAgent: AnonCredsTestsAgent
  let senderAgent: AnonCredsTestsAgent

  beforeEach(async () => {
    mediatorAgent = new Agent(mediatorOptions) as unknown as AnonCredsTestsAgent
    senderAgent = new Agent(senderOptions) as unknown as AnonCredsTestsAgent
  })

  afterEach(async () => {
    // NOTE: the order is important here, as the recipient sends pickup messages to the mediator
    // so we first want the recipient to fully be finished with the sending of messages
    await recipientAgent.shutdown()
    await mediatorAgent.shutdown()
    await senderAgent.shutdown()
  })

  test('Full WS flow (connect, request mediation, issue, verify) using Message Pickup V2 polling mode', async () => {
    const recipientOptions = getAgentOptions(
      'E2E WS Pickup V2 Recipient polling mode',
      {},
      {},
      {
        ...getAnonCredsModules({
          autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
        }),
        mediationRecipient: new DidCommMediationRecipientModule({
          mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV2,
          mediatorPollingInterval: 500,
        }),
      },
      { requireDidcomm: true }
    )

    recipientAgent = new Agent(recipientOptions) as unknown as AnonCredsTestsAgent

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

  test('Full WS flow (connect, request mediation, issue, verify) using Message Pickup V2 live mode', async () => {
    const recipientOptions = getAgentOptions(
      'E2E WS Pickup V2 Recipient live mode',
      {},
      {},
      {
        ...getAnonCredsModules({
          autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
        }),
        mediationRecipient: new DidCommMediationRecipientModule({
          mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV2LiveMode,
        }),
      },
      { requireDidcomm: true }
    )

    recipientAgent = new Agent(recipientOptions) as unknown as AnonCredsTestsAgent

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
