import { Agent, RecordNotFoundError } from '@credo-ts/core'
import { filter, firstValueFrom, map, Subject, throwError, timeout } from 'rxjs'
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { type EventReplaySubject, setupEventReplaySubjects } from '../../../../../core/tests/events'
import { getAgentOptions, makeConnection, waitForBasicMessageSubject } from '../../../../../core/tests/helpers'
import testLogger from '../../../../../core/tests/logger'
import { DidCommModule } from '../../../DidCommModule'
import { MessageSendingError } from '../../../errors'
import type { DidCommConnectionRecord } from '../../connections'
import {
  DidCommBasicMessageEventTypes,
  type DidCommBasicMessageV2StateChangedEvent,
} from '../DidCommBasicMessageEvents'
import { DidCommBasicMessage } from '../protocol/v1'
import { DidCommBasicMessageRecord } from '../repository'

function waitForBasicMessageV2(
  subject: EventReplaySubject,
  { content, timeoutMs = 5000 }: { content?: string; timeoutMs?: number } = {}
): Promise<DidCommBasicMessageRecord> {
  return firstValueFrom(
    subject.pipe(
      filter(
        (event): event is DidCommBasicMessageV2StateChangedEvent =>
          event.type === DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged
      ),
      filter((event) => content === undefined || event.payload.message.content === content),
      map((event) => event.payload.basicMessageRecord),
      timeout({
        first: timeoutMs,
        with: () =>
          throwError(
            () => new Error(`Timeout waiting for BasicMessage 2.0${content ? ` with content "${content}"` : ''}`)
          ),
      })
    )
  )
}

const faberConfig = getAgentOptions(
  'Faber Basic Messages',
  {
    endpoints: ['rxjs:faber'],
    didcommVersions: ['v1', 'v2'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

const aliceConfig = getAgentOptions(
  'Alice Basic Messages',
  {
    endpoints: ['rxjs:alice'],
    didcommVersions: ['v1', 'v2'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

const faberConfigWithV2 = getAgentOptions(
  'Faber Basic Messages V2',
  {
    endpoints: ['rxjs:faber-v2'],
    didcommVersions: ['v1', 'v2'],
    basicMessages: { protocols: ['v1', 'v2'] },
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

const aliceConfigWithV2 = getAgentOptions(
  'Alice Basic Messages V2',
  {
    endpoints: ['rxjs:alice-v2'],
    didcommVersions: ['v1', 'v2'],
    basicMessages: { protocols: ['v1', 'v2'] },
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

describe('Basic Messages E2E', () => {
  let faberAgent: Agent<{ didcomm: DidCommModule }>
  let aliceAgent: Agent<{ didcomm: DidCommModule }>
  let faberConnection: DidCommConnectionRecord
  let aliceConnection: DidCommConnectionRecord
  let faberReplay: EventReplaySubject
  let aliceReplay: EventReplaySubject

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent = new Agent(faberConfig)
    faberAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig)
    aliceAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()
    ;[faberReplay, aliceReplay] = setupEventReplaySubjects(
      [faberAgent, aliceAgent],
      [DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged]
    )
    ;[aliceConnection, faberConnection] = await makeConnection(aliceAgent, faberAgent)
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Alice and Faber exchange messages', async () => {
    testLogger.test('Alice sends message to Faber')
    const helloRecord = await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'Hello')

    expect(helloRecord.content).toBe('Hello')

    testLogger.test('Faber waits for message from Alice')
    await waitForBasicMessageSubject(faberReplay, {
      threadId: helloRecord.threadId,
      content: 'Hello',
    })

    testLogger.test('Faber sends message to Alice')
    const replyRecord = await faberAgent.didcomm.basicMessages.sendMessage(faberConnection.id, 'How are you?')
    expect(replyRecord.content).toBe('How are you?')

    testLogger.test('Alice waits until she receives message from faber')
    await waitForBasicMessageSubject(aliceReplay, {
      threadId: replyRecord.threadId,
      content: 'How are you?',
    })
  })

  test('Alice and Faber exchange messages using threadId', async () => {
    testLogger.test('Alice sends message to Faber')
    const helloRecord = await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'Hello')

    expect(helloRecord.content).toBe('Hello')

    testLogger.test('Faber waits for message from Alice')
    const helloMessage = await waitForBasicMessageSubject(faberReplay, {
      threadId: helloRecord.threadId,
      content: 'Hello',
    })

    testLogger.test('Faber sends message to Alice')
    const replyRecord = await faberAgent.didcomm.basicMessages.sendMessage(
      faberConnection.id,
      'How are you?',
      helloMessage.id
    )
    expect(replyRecord.content).toBe('How are you?')
    expect(replyRecord.parentThreadId).toBe(helloMessage.id)

    testLogger.test('Alice waits until she receives message from faber')
    const replyMessage = await waitForBasicMessageSubject(aliceReplay, {
      threadId: replyRecord.threadId,
      content: 'How are you?',
    })
    expect(replyMessage.content).toBe('How are you?')
    expect(replyMessage.thread?.parentThreadId).toBe(helloMessage.id)

    // Both sender and recipient shall be able to find the threaded messages
    // Hello message
    const aliceHelloMessage = await aliceAgent.didcomm.basicMessages.getByThreadId(helloMessage.id)
    const faberHelloMessage = await faberAgent.didcomm.basicMessages.getByThreadId(helloMessage.id)
    expect(aliceHelloMessage).toMatchObject({
      content: helloRecord.content,
      threadId: helloRecord.threadId,
    })
    expect(faberHelloMessage).toMatchObject({
      content: helloRecord.content,
      threadId: helloRecord.threadId,
    })

    // Reply message
    const aliceReplyMessages = await aliceAgent.didcomm.basicMessages.findAllByQuery({
      parentThreadId: helloMessage.id,
    })
    const faberReplyMessages = await faberAgent.didcomm.basicMessages.findAllByQuery({
      parentThreadId: helloMessage.id,
    })
    expect(aliceReplyMessages.length).toBe(1)
    expect(aliceReplyMessages[0]).toMatchObject({
      content: replyRecord.content,
      parentThreadId: replyRecord.parentThreadId,
      threadId: replyRecord.threadId,
    })
    expect(faberReplyMessages.length).toBe(1)
    expect(faberReplyMessages[0]).toMatchObject({
      content: replyRecord.content,
      parentThreadId: replyRecord.parentThreadId,
      threadId: replyRecord.threadId,
      connectionId: replyRecord.connectionId,
      role: replyRecord.role,
      sentTime: replyRecord.sentTime,
    })
  })

  test('Alice and Faber exchange BasicMessage 2.0 when protocols include 2.0', async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber-v2': faberMessages,
      'rxjs:alice-v2': aliceMessages,
    }

    const faberAgentV2 = new Agent(faberConfigWithV2)
    faberAgentV2.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgentV2.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgentV2.initialize()

    const aliceAgentV2 = new Agent(aliceConfigWithV2)
    aliceAgentV2.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgentV2.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgentV2.initialize()
    const [faberReplayV2, aliceReplayV2] = setupEventReplaySubjects(
      [faberAgentV2, aliceAgentV2],
      [DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged]
    )

    const [aliceConn, faberConn] = await makeConnection(aliceAgentV2, faberAgentV2, { didCommVersion: 'v2' })

    testLogger.test('Alice sends BM 2.0 to Faber')
    const helloRecord = await aliceAgentV2.didcomm.basicMessages.sendMessage(aliceConn.id, 'Hello 2.0')
    expect(helloRecord.content).toBe('Hello 2.0')
    expect(helloRecord.protocolVersion).toBe('v2')

    testLogger.test('Faber receives BM 2.0')
    const receivedHello = await waitForBasicMessageV2(faberReplayV2, { content: 'Hello 2.0' })
    expect(receivedHello.content).toBe('Hello 2.0')
    expect(receivedHello.protocolVersion).toBe('v2')

    testLogger.test('Faber sends BM 2.0 reply')
    const replyRecord = await faberAgentV2.didcomm.basicMessages.sendMessage(faberConn.id, 'Reply 2.0')
    expect(replyRecord.content).toBe('Reply 2.0')
    expect(replyRecord.protocolVersion).toBe('v2')

    await waitForBasicMessageV2(aliceReplayV2, { content: 'Reply 2.0' })

    await faberAgentV2.shutdown()
    await aliceAgentV2.shutdown()
  })

  test('Alice is unable to send a message', async () => {
    testLogger.test('Alice sends message to Faber that is undeliverable')

    const spy = vi
      .spyOn(aliceAgent.didcomm.outboundTransports[0], 'sendMessage')
      .mockRejectedValue(new Error('any error'))

    await expect(aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'Hello')).rejects.toThrow(
      MessageSendingError
    )
    try {
      await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'Hello undeliverable')
    } catch (error) {
      const thrownError = error as MessageSendingError
      expect(
        thrownError.message.startsWith(
          `Message is undeliverable to connection ${aliceConnection.id} (${aliceConnection.theirLabel})`
        )
      ).toBe(true)
      testLogger.test('Error thrown includes the outbound message and recently created record id')
      expect(thrownError.outboundMessageContext.associatedRecord).toBeInstanceOf(DidCommBasicMessageRecord)
      expect(thrownError.outboundMessageContext.message).toBeInstanceOf(DidCommBasicMessage)
      expect((thrownError.outboundMessageContext.message as DidCommBasicMessage).content).toBe('Hello undeliverable')

      testLogger.test('Created record can be found and deleted by id')
      const storedRecord = await aliceAgent.didcomm.basicMessages.getById(
        thrownError.outboundMessageContext.associatedRecord?.id as string
      )
      expect(storedRecord).toBeInstanceOf(DidCommBasicMessageRecord)
      expect(storedRecord.content).toBe('Hello undeliverable')

      await aliceAgent.didcomm.basicMessages.deleteById(storedRecord.id)
      await expect(
        aliceAgent.didcomm.basicMessages.getById(thrownError.outboundMessageContext.associatedRecord?.id as string)
      ).rejects.toThrow(RecordNotFoundError)
    }
    spy.mockClear()
  })
})
