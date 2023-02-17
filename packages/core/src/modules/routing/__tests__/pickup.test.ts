/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { getIndySdkModules } from '../../../../../indy-sdk/tests/setupIndySdkModule'
import { getAgentOptions, waitForBasicMessage, waitForTrustPingReceivedEvent } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { HandshakeProtocol } from '../../connections'
import { MediatorPickupStrategy } from '../MediatorPickupStrategy'

const recipientOptions = getAgentOptions(
  'Mediation: Recipient Pickup',
  {
    autoAcceptConnections: true,
  },
  getIndySdkModules()
)
const mediatorOptions = getAgentOptions(
  'Mediation: Mediator Pickup',
  {
    autoAcceptConnections: true,
    endpoints: ['wss://mediator'],
  },
  getIndySdkModules()
)

describe('E2E Pick Up protocol', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent

  afterEach(async () => {
    await recipientAgent.shutdown()
    await recipientAgent.wallet.delete()
    await mediatorAgent.shutdown()
    await mediatorAgent.wallet.delete()
  })

  test('E2E Pick Up V1 protocol', async () => {
    const mediatorMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'wss://mediator': mediatorMessages,
    }

    // Initialize mediatorReceived message
    mediatorAgent = new Agent(mediatorOptions)
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [HandshakeProtocol.DidExchange],
    })

    // Initialize recipient
    recipientAgent = new Agent(recipientOptions)
    recipientAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Connect
    const mediatorInvitation = mediatorOutOfBandRecord.outOfBandInvitation

    let { connectionRecord: recipientMediatorConnection } = await recipientAgent.oob.receiveInvitationFromUrl(
      mediatorInvitation.toUrl({ domain: 'https://example.com/ssi' })
    )

    recipientMediatorConnection = await recipientAgent.connections.returnWhenIsConnected(
      recipientMediatorConnection!.id
    )

    let [mediatorRecipientConnection] = await mediatorAgent.connections.findAllByOutOfBandId(mediatorOutOfBandRecord.id)

    mediatorRecipientConnection = await mediatorAgent.connections.returnWhenIsConnected(mediatorRecipientConnection!.id)

    const message = 'hello pickup V1'
    await mediatorAgent.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    await recipientAgent.mediationRecipient.pickupMessages(recipientMediatorConnection, MediatorPickupStrategy.PickUpV1)

    const basicMessage = await waitForBasicMessage(recipientAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })

  test('E2E Pick Up V2 protocol', async () => {
    const mediatorMessages = new Subject<SubjectMessage>()

    // FIXME: we harcoded that pickup of messages MUST be using ws(s) scheme when doing implicit pickup
    // For liver delivery we need a duplex transport. however that means we can't test it with the subject transport. Using wss here to 'hack' this. We should
    // extend the API to allow custom schemes (or maybe add a `supportsDuplex` transport / `supportMultiReturnMessages`)
    // For pickup v2 pickup message (which we're testing here) we could just as well use `http` as it is just request/response.
    const subjectMap = {
      'wss://mediator': mediatorMessages,
    }

    // Initialize mediatorReceived message
    mediatorAgent = new Agent(mediatorOptions)
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [HandshakeProtocol.DidExchange],
    })

    // Initialize recipient
    recipientAgent = new Agent(recipientOptions)
    recipientAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Connect
    const mediatorInvitation = mediatorOutOfBandRecord.outOfBandInvitation

    let { connectionRecord: recipientMediatorConnection } = await recipientAgent.oob.receiveInvitationFromUrl(
      mediatorInvitation.toUrl({ domain: 'https://example.com/ssi' })
    )

    recipientMediatorConnection = await recipientAgent.connections.returnWhenIsConnected(
      recipientMediatorConnection!.id
    )

    let [mediatorRecipientConnection] = await mediatorAgent.connections.findAllByOutOfBandId(mediatorOutOfBandRecord.id)

    mediatorRecipientConnection = await mediatorAgent.connections.returnWhenIsConnected(mediatorRecipientConnection!.id)

    const message = 'hello pickup V2'

    await mediatorAgent.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    const basicMessagePromise = waitForBasicMessage(recipientAgent, {
      content: message,
    })
    const trustPingPromise = waitForTrustPingReceivedEvent(mediatorAgent, {})
    await recipientAgent.mediationRecipient.pickupMessages(recipientMediatorConnection, MediatorPickupStrategy.PickUpV2)

    const basicMessage = await basicMessagePromise
    expect(basicMessage.content).toBe(message)

    // Wait for trust ping to be received and stop message pickup
    await trustPingPromise
    await recipientAgent.mediationRecipient.stopMessagePickup()
  })
})
