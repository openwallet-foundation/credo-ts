import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import type { DidCommConnectionRecord } from '../../connections'

import { Agent, RecordNotFoundError } from '@credo-ts/core'
import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { getAgentOptions, makeConnection, waitForBasicMessage } from '../../../../../core/tests/helpers'
import testLogger from '../../../../../core/tests/logger'
import { DidCommModule } from '../../../DidCommModule'
import { MessageSendingError } from '../../../errors'
import { DidCommBasicMessage } from '../messages'
import { DidCommBasicMessageRecord } from '../repository'

const faberConfig = getAgentOptions(
  'Faber Basic Messages',
  {
    endpoints: ['rxjs:faber'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

const aliceConfig = getAgentOptions(
  'Alice Basic Messages',
  {
    endpoints: ['rxjs:alice'],
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
    await waitForBasicMessage(faberAgent, {
      content: 'Hello',
    })

    testLogger.test('Faber sends message to Alice')
    const replyRecord = await faberAgent.didcomm.basicMessages.sendMessage(faberConnection.id, 'How are you?')
    expect(replyRecord.content).toBe('How are you?')

    testLogger.test('Alice waits until she receives message from faber')
    await waitForBasicMessage(aliceAgent, {
      content: 'How are you?',
    })
  })

  test('Alice and Faber exchange messages using threadId', async () => {
    testLogger.test('Alice sends message to Faber')
    const helloRecord = await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'Hello')

    expect(helloRecord.content).toBe('Hello')

    testLogger.test('Faber waits for message from Alice')
    const helloMessage = await waitForBasicMessage(faberAgent, {
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
    const replyMessage = await waitForBasicMessage(aliceAgent, {
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
    expect(faberReplyMessages[0]).toMatchObject(replyRecord)
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
