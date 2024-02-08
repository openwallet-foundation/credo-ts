/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../../connections'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { getInMemoryAgentOptions, makeConnection } from '../../../../tests/helpers'
import testLogger from '../../../../tests/logger'
import { Agent } from '../../../agent/Agent'
import { MessageSendingError, RecordNotFoundError } from '../../../error'
import { DRPCErrorCode, DRPCRequestMessage, DRPCResponseMessage, DRPCResponseObject } from '../messages'
import { DRPCMessageRecord } from '../repository'

const faberConfig = getInMemoryAgentOptions('Faber DRPC Messages', {
  endpoints: ['rxjs:faber'],
})

const aliceConfig = getInMemoryAgentOptions('Alice DRPC Messages', {
  endpoints: ['rxjs:alice'],
})

describe('DRPC Messages E2E', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent = new Agent(faberConfig)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()
    ;[aliceConnection, faberConnection] = await makeConnection(aliceAgent, faberAgent)
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice and Faber exchange messages', async () => {
    testLogger.test('Alice sends message to Faber')
    faberAgent.drpcMessages.createDRPCMethodHandler('hello', async (message) => {
      return {jsonrpc: '2.0', result: 'Hello', id: message.id}
    })
    const helloRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {jsonrpc: '2.0', method: 'hello', id: 1})
    expect((helloRecord.response as DRPCResponseObject).result).toBe('Hello')

    faberAgent.drpcMessages.createDRPCMethodHandler('add', async (message) => {
      const operands = message.params as number[]
      const result = operands.reduce((a, b) => a + b, 0)
      return {jsonrpc: '2.0', result, id: message.id}
    })

    const addRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {jsonrpc: '2.0', method: 'add', params: [2, 3, 7], id: 2})
    expect((addRecord.response as DRPCResponseObject).result).toBe(12)

    faberAgent.drpcMessages.createDRPCMethodHandler('parseFoo', async (message) => {
      const params = message.params as {foo: string}
      return {jsonrpc: '2.0', result: params.foo, id: message.id}
    })

    const parseFooRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {jsonrpc: '2.0', method: 'parseFoo', params: {foo: 'bar'}, id: 3})
    expect((parseFooRecord.response as DRPCResponseObject).result).toBe('bar')

    const errorRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {jsonrpc: '2.0', method: 'error', id: 4})
    expect((errorRecord.response as DRPCResponseObject).error).toBeDefined()
    expect((errorRecord.response as DRPCResponseObject).error?.code).toBe(DRPCErrorCode.METHOD_NOT_FOUND)
  })

  // test('Alice and Faber exchange messages using threadId', async () => {
  //   testLogger.test('Alice sends message to Faber')
  //   const helloRecord = await aliceAgent.drpcMessages.sendMessage(aliceConnection.id, 'Hello')

  //   expect(helloRecord.content).toBe('Hello')

  //   testLogger.test('Faber waits for message from Alice')
  //   const helloMessage = await waitForDRPCMessage(faberAgent, {
  //     content: 'Hello',
  //   })

  //   testLogger.test('Faber sends message to Alice')
  //   const replyRecord = await faberAgent.drpcMessages.sendMessage(faberConnection.id, 'How are you?', helloMessage.id)
  //   expect(replyRecord.content).toBe('How are you?')
  //   expect(replyRecord.parentThreadId).toBe(helloMessage.id)

  //   testLogger.test('Alice waits until she receives message from faber')
  //   const replyMessage = await waitForDRPCMessage(aliceAgent, {
  //     content: 'How are you?',
  //   })
  //   expect(replyMessage.content).toBe('How are you?')
  //   expect(replyMessage.thread?.parentThreadId).toBe(helloMessage.id)

  //   // Both sender and recipient shall be able to find the threaded messages
  //   // Hello message
  //   const aliceHelloMessage = await aliceAgent.drpcMessages.getByThreadId(helloMessage.id)
  //   const faberHelloMessage = await faberAgent.drpcMessages.getByThreadId(helloMessage.id)
  //   expect(aliceHelloMessage).toMatchObject({
  //     content: helloRecord.content,
  //     threadId: helloRecord.threadId,
  //   })
  //   expect(faberHelloMessage).toMatchObject({
  //     content: helloRecord.content,
  //     threadId: helloRecord.threadId,
  //   })

  //   // Reply message
  //   const aliceReplyMessages = await aliceAgent.drpcMessages.findAllByQuery({ parentThreadId: helloMessage.id })
  //   const faberReplyMessages = await faberAgent.drpcMessages.findAllByQuery({ parentThreadId: helloMessage.id })
  //   expect(aliceReplyMessages.length).toBe(1)
  //   expect(aliceReplyMessages[0]).toMatchObject({
  //     content: replyRecord.content,
  //     parentThreadId: replyRecord.parentThreadId,
  //     threadId: replyRecord.threadId,
  //   })
  //   expect(faberReplyMessages.length).toBe(1)
  //   expect(faberReplyMessages[0]).toMatchObject(replyRecord)
  // })

  // test('Alice is unable to send a message', async () => {
  //   testLogger.test('Alice sends message to Faber that is undeliverable')

  //   const spy = jest.spyOn(aliceAgent.outboundTransports[0], 'sendMessage').mockRejectedValue(new Error('any error'))

  //   await expect(aliceAgent.drpcMessages.sendMessage(aliceConnection.id, 'Hello')).rejects.toThrowError(
  //     MessageSendingError
  //   )
  //   try {
  //     await aliceAgent.drpcMessages.sendMessage(aliceConnection.id, 'Hello undeliverable')
  //   } catch (error) {
  //     const thrownError = error as MessageSendingError
  //     expect(thrownError.message).toEqual(
  //       `Message is undeliverable to connection ${aliceConnection.id} (${aliceConnection.theirLabel})`
  //     )
  //     testLogger.test('Error thrown includes the outbound message and recently created record id')
  //     expect(thrownError.outboundMessageContext.associatedRecord).toBeInstanceOf(DRPCMessageRecord)
  //     expect(thrownError.outboundMessageContext.message).toBeInstanceOf(DRPCMessage)
  //     expect((thrownError.outboundMessageContext.message as DRPCMessage).content).toBe('Hello undeliverable')

  //     testLogger.test('Created record can be found and deleted by id')
  //     const storedRecord = await aliceAgent.drpcMessages.getById(
  //       thrownError.outboundMessageContext.associatedRecord!.id
  //     )
  //     expect(storedRecord).toBeInstanceOf(DRPCMessageRecord)
  //     expect(storedRecord.content).toBe('Hello undeliverable')

  //     await aliceAgent.drpcMessages.deleteById(storedRecord.id)
  //     await expect(
  //       aliceAgent.drpcMessages.getById(thrownError.outboundMessageContext.associatedRecord!.id)
  //     ).rejects.toThrowError(RecordNotFoundError)
  //   }
  //   spy.mockClear()
  // })
})
