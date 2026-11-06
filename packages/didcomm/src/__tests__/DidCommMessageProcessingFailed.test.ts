import { Agent, type AgentContext, EventEmitter } from '@credo-ts/core'
import { filter, firstValueFrom, Subject, take, timeout } from 'rxjs'
import type { SubjectMessage } from '../../../../tests/transport/SubjectInboundTransport'
import { SubjectInboundTransport } from '../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../tests/transport/SubjectOutboundTransport'
import { getAgentOptions, makeConnection } from '../../../core/tests/helpers'
import type {
  DidCommMessageProcessedEvent,
  DidCommMessageProcessingFailedEvent,
  DidCommMessageReceivedEvent,
} from '../DidCommEvents'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommModule } from '../DidCommModule'
import type { DidCommBasicMessageStateChangedEvent } from '../modules/basic-messages/DidCommBasicMessageEvents'
import { DidCommBasicMessageEventTypes } from '../modules/basic-messages/DidCommBasicMessageEvents'
import type { DidCommConnectionRecord } from '../modules/connections'
import type { DidCommInboundTransport } from '../transport'

class ReceivedMessageEventInboundTransport implements DidCommInboundTransport {
  private eventEmitter?: EventEmitter
  private agentContext?: AgentContext

  public async start(agentContext: AgentContext) {
    this.agentContext = agentContext
    this.eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
  }

  public async stop() {}

  public deliverMessage(message: unknown, payload: Partial<DidCommMessageReceivedEvent['payload']> = {}) {
    if (!this.agentContext || !this.eventEmitter) {
      throw new Error('Inbound transport has not been started')
    }

    this.eventEmitter.emit<DidCommMessageReceivedEvent>(this.agentContext, {
      type: DidCommEventTypes.DidCommMessageReceived,
      payload: { message, ...payload },
    })
  }
}

describe('DidCommMessageProcessingFailed', () => {
  let senderAgent: Agent<{ didcomm: DidCommModule }>
  let receiverAgent: Agent<{ didcomm: DidCommModule }>
  let senderConnectionId: string
  let receiverConnection: DidCommConnectionRecord
  let subjectMap: Record<string, Subject<SubjectMessage>>
  let receivedMessageEventTransport: ReceivedMessageEventInboundTransport

  beforeEach(async () => {
    const senderMessages = new Subject<SubjectMessage>()
    const receiverMessages = new Subject<SubjectMessage>()
    subjectMap = {
      'rxjs:sender': senderMessages,
      'rxjs:receiver': receiverMessages,
    }

    senderAgent = new Agent(
      getAgentOptions('DIDComm Processing Failure Sender', { endpoints: ['rxjs:sender'] }, undefined, undefined, {
        requireDidcomm: true,
      })
    )
    senderAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(senderMessages))
    senderAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await senderAgent.initialize()

    receiverAgent = new Agent(
      getAgentOptions('DIDComm Processing Failure Receiver', { endpoints: ['rxjs:receiver'] }, undefined, undefined, {
        requireDidcomm: true,
      })
    )
    receiverAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(receiverMessages))
    receivedMessageEventTransport = new ReceivedMessageEventInboundTransport()
    receiverAgent.didcomm.registerInboundTransport(receivedMessageEventTransport)
    receiverAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await receiverAgent.initialize()

    const [connectionToReceiver, connectionToSender] = await makeConnection(senderAgent, receiverAgent)
    senderConnectionId = connectionToReceiver.id
    receiverConnection = connectionToSender
  })

  afterEach(async () => {
    await senderAgent.shutdown()
    await receiverAgent.shutdown()
  })

  test('emits one failure event for invalid plaintext', async () => {
    const failureEvent = firstValueFrom(
      receiverAgent.events
        .observable<DidCommMessageProcessingFailedEvent>(DidCommEventTypes.DidCommMessageProcessingFailed)
        .pipe(take(1), timeout(10000))
    )
    const plaintextMessage = { '@id': 'invalid-plaintext' }
    const contextCorrelationId = receiverAgent.context.contextCorrelationId
    const receivedAt = new Date()

    // Inject directly into transport
    receivedMessageEventTransport.deliverMessage(plaintextMessage, {
      connection: receiverConnection,
      contextCorrelationId,
      receivedAt,
    })

    const event = await failureEvent
    expect(event.payload.error).toBeInstanceOf(Error)
    expect(event.payload.message).toBe(plaintextMessage)
    expect(event.payload.connection).toBe(receiverConnection)
    expect(event.payload.contextCorrelationId).toBe(contextCorrelationId)
    expect(event.payload.receivedAt).toBe(receivedAt)
  })

  test('emits one failure event for an undecryptable encrypted message', async () => {
    const failureEvent = firstValueFrom(
      receiverAgent.events
        .observable<DidCommMessageProcessingFailedEvent>(DidCommEventTypes.DidCommMessageProcessingFailed)
        .pipe(take(1), timeout(10000))
    )
    const encryptedMessage = {
      protected: 'not-a-valid-protected-header',
      iv: 'invalid-iv',
      ciphertext: 'invalid-ciphertext',
      tag: 'invalid-tag',
    }

    // Inject directly into transport
    receivedMessageEventTransport.deliverMessage(encryptedMessage)

    const event = await failureEvent
    expect(event.payload.error).toBeInstanceOf(Error)
    expect(event.payload.message).toBe(encryptedMessage)
    expect(event.payload.connection).toBeUndefined()
    expect(event.payload.contextCorrelationId).toBeUndefined()
    expect(event.payload.receivedAt).toBeUndefined()
  })

  test('continues processing through the BasicMessage handler when a failure event listener throws', async () => {
    const throwingListener = vi.fn(() => {
      throw new Error('Failure event listener threw')
    })
    receiverAgent.events.on<DidCommMessageProcessingFailedEvent>(
      DidCommEventTypes.DidCommMessageProcessingFailed,
      throwingListener
    )

    // Send malformed message to the transport and await DidCommMessageProcessingFailedEvent
    receivedMessageEventTransport.deliverMessage({ '@id': 'invalid-plaintext' })
    await vi.waitFor(() => expect(throwingListener).toHaveBeenCalledOnce())

    // Now send a correctly formed BasicMessage through the connected agents.
    const messageProcessed = firstValueFrom(
      receiverAgent.events
        .observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed)
        .pipe(timeout(10000))
    )
    const basicMessageHandled = firstValueFrom(
      receiverAgent.events
        .observable<DidCommBasicMessageStateChangedEvent>(DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged)
        .pipe(
          filter((event) => event.payload.message.content === 'Still processing'),
          timeout(10000)
        )
    )

    await senderAgent.didcomm.basicMessages.sendMessage(senderConnectionId, 'Still processing')

    const [processedEvent, handledEvent] = await Promise.all([messageProcessed, basicMessageHandled])
    expect(processedEvent.payload.message.type).toBe(handledEvent.payload.message.type)
  })
})
