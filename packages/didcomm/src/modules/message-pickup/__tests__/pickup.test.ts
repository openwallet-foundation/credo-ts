import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../core/src/agent/Agent'
import {
  getAgentOptions,
  waitForAgentMessageProcessedEvent,
  waitForBasicMessage,
} from '../../../../../core/tests/helpers'
import { DidCommHandshakeProtocol } from '../../connections'
import { DidCommMessageForwardingStrategy } from '../../routing/DidCommMessageForwardingStrategy'
import { DidCommMessagesReceivedV2Message, DidCommStatusV2Message } from '../protocol'

const recipientOptions = getAgentOptions('Mediation Pickup Loop Recipient', undefined, undefined, undefined, {
  requireDidcomm: true,
  inMemory: false,
})
const mediatorOptions = getAgentOptions(
  'Mediation Pickup Loop Mediator',
  {
    endpoints: ['wss://mediator'],
    mediator: {
      autoAcceptMediationRequests: true,
      messageForwardingStrategy: DidCommMessageForwardingStrategy.QueueAndLiveModeDelivery,
    },
  },
  {},
  {},
  { requireDidcomm: true, inMemory: false }
)

describe('E2E Pick Up protocol', () => {
  let recipientAgent: Agent<(typeof recipientOptions)['modules']>
  let mediatorAgent: Agent<(typeof mediatorOptions)['modules']>

  afterEach(async () => {
    await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()

    await recipientAgent.shutdown()
    await mediatorAgent.shutdown()
  })

  test('E2E manual Pick Up V1 loop', async () => {
    const mediatorMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'wss://mediator': mediatorMessages,
    }

    // Initialize mediatorReceived message
    mediatorAgent = new Agent(mediatorOptions)
    mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Initialize recipient
    recipientAgent = new Agent(recipientOptions)
    recipientAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Connect
    const mediatorInvitation = mediatorOutOfBandRecord.outOfBandInvitation

    let { connectionRecord: recipientMediatorConnection } = await recipientAgent.didcomm.oob.receiveInvitationFromUrl(
      mediatorInvitation.toUrl({ domain: 'https://example.com/ssi' }),
      { label: 'recipient' }
    )

    recipientMediatorConnection = await recipientAgent.didcomm.connections.returnWhenIsConnected(
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      recipientMediatorConnection!.id
    )

    let [mediatorRecipientConnection] = await mediatorAgent.didcomm.connections.findAllByOutOfBandId(
      mediatorOutOfBandRecord.id
    )

    mediatorRecipientConnection = await mediatorAgent.didcomm.connections.returnWhenIsConnected(
      mediatorRecipientConnection?.id
    )

    // Now they are connected, reinitialize recipient agent in order to lose the session (as with SubjectTransport it remains open)
    await recipientAgent.shutdown()
    await recipientAgent.initialize()

    const message = 'hello pickup V1'
    await mediatorAgent.didcomm.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    await recipientAgent.didcomm.messagePickup.pickupMessages({
      connectionId: recipientMediatorConnection.id,
      protocolVersion: 'v1',
    })

    const basicMessage = await waitForBasicMessage(recipientAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })

  test('E2E manual Pick Up V1 loop - waiting for completion', async () => {
    const mediatorMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'wss://mediator': mediatorMessages,
    }

    // Initialize mediatorReceived message
    mediatorAgent = new Agent(mediatorOptions)
    mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Initialize recipient
    recipientAgent = new Agent(recipientOptions)
    recipientAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Connect
    const mediatorInvitation = mediatorOutOfBandRecord.outOfBandInvitation

    let { connectionRecord: recipientMediatorConnection } = await recipientAgent.didcomm.oob.receiveInvitationFromUrl(
      mediatorInvitation.toUrl({ domain: 'https://example.com/ssi' }),
      { label: 'recipient' }
    )

    recipientMediatorConnection = await recipientAgent.didcomm.connections.returnWhenIsConnected(
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      recipientMediatorConnection!.id
    )

    let [mediatorRecipientConnection] = await mediatorAgent.didcomm.connections.findAllByOutOfBandId(
      mediatorOutOfBandRecord.id
    )

    mediatorRecipientConnection = await mediatorAgent.didcomm.connections.returnWhenIsConnected(
      mediatorRecipientConnection?.id
    )

    // Now they are connected, reinitialize recipient agent in order to lose the session (as with SubjectTransport it remains open)
    await recipientAgent.shutdown()
    await recipientAgent.initialize()

    const message = 'hello pickup V1'
    await mediatorAgent.didcomm.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    const basicMessagePromise = waitForBasicMessage(recipientAgent, {
      content: message,
    })
    await recipientAgent.didcomm.messagePickup.pickupMessages({
      connectionId: recipientMediatorConnection.id,
      protocolVersion: 'v1',
      awaitCompletion: true,
    })

    const basicMessage = await basicMessagePromise
    expect(basicMessage.content).toBe(message)
  })

  test('E2E manual Pick Up V2 loop', async () => {
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
    mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Initialize recipient
    recipientAgent = new Agent(recipientOptions)
    recipientAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Connect
    const mediatorInvitation = mediatorOutOfBandRecord.outOfBandInvitation

    let { connectionRecord: recipientMediatorConnection } = await recipientAgent.didcomm.oob.receiveInvitationFromUrl(
      mediatorInvitation.toUrl({ domain: 'https://example.com/ssi' }),
      { label: 'recipient' }
    )

    recipientMediatorConnection = await recipientAgent.didcomm.connections.returnWhenIsConnected(
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      recipientMediatorConnection!.id
    )

    let [mediatorRecipientConnection] = await mediatorAgent.didcomm.connections.findAllByOutOfBandId(
      mediatorOutOfBandRecord.id
    )

    mediatorRecipientConnection = await mediatorAgent.didcomm.connections.returnWhenIsConnected(
      mediatorRecipientConnection.id
    )

    // Now they are connected, reinitialize recipient agent in order to lose the session (as with SubjectTransport it remains open)
    await recipientAgent.shutdown()
    await recipientAgent.initialize()

    const message = 'hello pickup V2'

    await mediatorAgent.didcomm.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    const basicMessagePromise = waitForBasicMessage(recipientAgent, {
      content: message,
    })
    await recipientAgent.didcomm.messagePickup.pickupMessages({
      connectionId: recipientMediatorConnection.id,
      protocolVersion: 'v2',
    })
    const firstStatusMessage = await waitForAgentMessageProcessedEvent(recipientAgent, {
      messageType: DidCommStatusV2Message.type.messageTypeUri,
    })

    expect((firstStatusMessage as DidCommStatusV2Message).messageCount).toBe(1)

    const basicMessage = await basicMessagePromise
    expect(basicMessage.content).toBe(message)

    const messagesReceived = await waitForAgentMessageProcessedEvent(mediatorAgent, {
      messageType: DidCommMessagesReceivedV2Message.type.messageTypeUri,
    })

    expect((messagesReceived as DidCommMessagesReceivedV2Message).messageIdList.length).toBe(1)

    const secondStatusMessage = await waitForAgentMessageProcessedEvent(recipientAgent, {
      messageType: DidCommStatusV2Message.type.messageTypeUri,
    })

    expect((secondStatusMessage as DidCommStatusV2Message).messageCount).toBe(0)
  })

  test('E2E manual Pick Up V2 loop - waiting for completion', async () => {
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
    mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    // Create connection to use for recipient
    const mediatorOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'mediator invitation',
      handshake: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Initialize recipient
    recipientAgent = new Agent(recipientOptions)
    recipientAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await recipientAgent.initialize()

    // Connect
    const mediatorInvitation = mediatorOutOfBandRecord.outOfBandInvitation

    let { connectionRecord: recipientMediatorConnection } = await recipientAgent.didcomm.oob.receiveInvitationFromUrl(
      mediatorInvitation.toUrl({ domain: 'https://example.com/ssi' }),
      { label: 'recipient' }
    )

    recipientMediatorConnection = await recipientAgent.didcomm.connections.returnWhenIsConnected(
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      recipientMediatorConnection!.id
    )

    let [mediatorRecipientConnection] = await mediatorAgent.didcomm.connections.findAllByOutOfBandId(
      mediatorOutOfBandRecord.id
    )

    mediatorRecipientConnection = await mediatorAgent.didcomm.connections.returnWhenIsConnected(
      mediatorRecipientConnection.id
    )

    // Now they are connected, reinitialize recipient agent in order to lose the session (as with SubjectTransport it remains open)
    await recipientAgent.shutdown()
    await recipientAgent.initialize()

    const message = 'hello pickup V2'

    await mediatorAgent.didcomm.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    const basicMessagePromise = waitForBasicMessage(recipientAgent, {
      content: message,
    })
    await recipientAgent.didcomm.messagePickup.pickupMessages({
      connectionId: recipientMediatorConnection.id,
      protocolVersion: 'v2',
      awaitCompletion: true,
    })

    const basicMessage = await basicMessagePromise
    expect(basicMessage.content).toBe(message)
  })
})
