import { filter, firstValueFrom, map, Subject, take, timeout, toArray } from 'rxjs'
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../core/src/agent/Agent'
import { setupEventReplaySubjects } from '../../../../../core/tests'
import {
  getAgentOptions,
  waitForAgentMessageProcessedEventSubject,
  waitForBasicMessageSubject,
} from '../../../../../core/tests/helpers'
import type { DidCommMessageProcessedEvent } from '../../../DidCommEvents'
import { DidCommEventTypes } from '../../../DidCommEvents'
import { DidCommBasicMessageEventTypes } from '../../basic-messages'
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
      // biome-ignore lint/style/noNonNullAssertion: no explanation
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
    const [recipientBasicMessageReplay] = setupEventReplaySubjects(
      [recipientAgent],
      [DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged]
    )

    const message = 'hello pickup V1'
    const { threadId } = await mediatorAgent.didcomm.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    await recipientAgent.didcomm.messagePickup.pickupMessages({
      connectionId: recipientMediatorConnection.id,
      protocolVersion: 'v1',
    })

    const basicMessage = await waitForBasicMessageSubject(recipientBasicMessageReplay, {
      threadId,
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
      // biome-ignore lint/style/noNonNullAssertion: no explanation
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
    const [recipientBasicMessageReplay] = setupEventReplaySubjects(
      [recipientAgent],
      [DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged]
    )

    const message = 'hello pickup V1'
    const { threadId } = await mediatorAgent.didcomm.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    const basicMessagePromise = waitForBasicMessageSubject(recipientBasicMessageReplay, {
      threadId,
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
      // biome-ignore lint/style/noNonNullAssertion: no explanation
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

    const { threadId } = await mediatorAgent.didcomm.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    // `pickupMessages` triggers the whole exchange, so subscribe to all events before calling it
    const [recipientReplay, mediatorReplay] = setupEventReplaySubjects(
      [recipientAgent, mediatorAgent],
      [DidCommEventTypes.DidCommMessageProcessed, DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged]
    )

    // One status before delivery (1 message queued), and one after it was acknowledged (0 queued)
    const statusMessagesPromise = firstValueFrom(
      recipientReplay.pipe(
        filter((event) => event.type === DidCommEventTypes.DidCommMessageProcessed),
        map((event) => (event as DidCommMessageProcessedEvent).payload.message),
        filter((agentMessage) => agentMessage.type === DidCommStatusV2Message.type.messageTypeUri),
        take(2),
        toArray(),
        timeout(10000)
      )
    )
    const messagesReceivedPromise = waitForAgentMessageProcessedEventSubject(mediatorReplay, {
      messageType: DidCommMessagesReceivedV2Message.type.messageTypeUri,
    })
    const basicMessagePromise = waitForBasicMessageSubject(recipientReplay, {
      threadId,
      content: message,
    })

    await recipientAgent.didcomm.messagePickup.pickupMessages({
      connectionId: recipientMediatorConnection.id,
      protocolVersion: 'v2',
    })

    const [firstStatusMessage, secondStatusMessage] = (await statusMessagesPromise) as DidCommStatusV2Message[]
    expect(firstStatusMessage.messageCount).toBe(1)

    const basicMessage = await basicMessagePromise
    expect(basicMessage.content).toBe(message)

    const messagesReceived = await messagesReceivedPromise
    expect((messagesReceived as DidCommMessagesReceivedV2Message).messageIdList.length).toBe(1)

    expect(secondStatusMessage.messageCount).toBe(0)
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
      // biome-ignore lint/style/noNonNullAssertion: no explanation
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
    const [recipientBasicMessageReplay] = setupEventReplaySubjects(
      [recipientAgent],
      [DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged]
    )

    const message = 'hello pickup V2'

    const { threadId } = await mediatorAgent.didcomm.basicMessages.sendMessage(mediatorRecipientConnection.id, message)

    const basicMessagePromise = waitForBasicMessageSubject(recipientBasicMessageReplay, {
      threadId,
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
