/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../../connections'
import type { DRPCRequest, DRPCRequestObject, DRPCResponseObject } from '../messages'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { getInMemoryAgentOptions, makeConnection } from '../../../../tests/helpers'
import testLogger from '../../../../tests/logger'
import { Agent } from '../../../agent/Agent'
import { DRPCErrorCode } from '../messages'

const faberConfig = getInMemoryAgentOptions('Faber DRPC Messages', {
  endpoints: ['rxjs:faber'],
})

const aliceConfig = getInMemoryAgentOptions('Alice DRPC Messages', {
  endpoints: ['rxjs:alice'],
})

const handleMessageOrError = async (handlers: Map<string, (message: DRPCRequestObject) => Promise<DRPCResponseObject | Record<string, never>>>, message: DRPCRequestObject) => {
  const handler = handlers.get(message.method)
  if (handler) {
    return handler(message)
  }
  return { jsonrpc: '2.0', id: message.id, error: { code: DRPCErrorCode.METHOD_NOT_FOUND, message: 'Method not found' } }
}

const sendAndRecieve = async (sender: Agent, receiver: Agent, connectionRecord: ConnectionRecord, message: DRPCRequestObject, messageHandlers: Map<string, (message: DRPCRequestObject) => Promise<DRPCResponseObject | Record<string, never>>>) => {
  const recordProm = sender.drpcMessages.sendDRPCRequest(connectionRecord.id, message)
  const { connectionId, threadId, request } = await receiver.drpcMessages.nextDRPCRequest();
  const result = await handleMessageOrError(messageHandlers, request as DRPCRequestObject);
  await receiver.drpcMessages.sendDRPCResponse(connectionId, threadId, result as DRPCResponseObject);

  const helloRecord = await recordProm;
  return helloRecord as DRPCResponseObject
}

const sendAndRecieveBatch = async (sender: Agent, receiver: Agent, connectionRecord: ConnectionRecord, message: DRPCRequestObject[], messageHandlers: Map<string, (message: DRPCRequestObject) => Promise<DRPCResponseObject | Record<string, never>>>) => {
  const batchRecordProm = sender.drpcMessages.sendDRPCRequest(connectionRecord.id, message)

  const { connectionId: batchConnId, threadId: batchThreadId, request: batchRequest } = await receiver.drpcMessages.nextDRPCRequest();
  const batchRequests = batchRequest as DRPCRequestObject[]
  const batchResults:(DRPCResponseObject | Record<string,never>)[] = []
  for (const request of batchRequests) {
    batchResults.push(await handleMessageOrError(messageHandlers, request))
  }
  await receiver.drpcMessages.sendDRPCResponse(batchConnId, batchThreadId, batchResults);
  const batchRecord = await batchRecordProm
  return batchRecord as DRPCResponseObject[]
}

describe('DRPC Messages E2E', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let messageHandlers: Map<string, (message: DRPCRequestObject) => Promise<DRPCResponseObject | Record<string, never>>>

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
      ;[aliceConnection] = await makeConnection(aliceAgent, faberAgent)


    messageHandlers = new Map()
    messageHandlers.set('hello', async (message: DRPCRequestObject) => {
      return { jsonrpc: '2.0', result: 'Hello', id: message.id }
    })
    messageHandlers.set('add', async (message) => {
      const operands = message.params as number[]
      const result = operands.reduce((a, b) => a + b, 0)
      return { jsonrpc: '2.0', result, id: message.id }
    })
    messageHandlers.set('parseFoo', async (message) => {
      const params = message.params as { foo: string }
      return { jsonrpc: '2.0', result: params.foo, id: message.id }
    })
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice and Faber exchange messages', async () => {
    testLogger.test('Alice sends message to Faber')
    const helloRecord = await sendAndRecieve(aliceAgent, faberAgent, aliceConnection, {
      jsonrpc: '2.0',
      method: 'hello',
      id: 1,
    }, messageHandlers)
    expect((helloRecord as DRPCResponseObject).result).toBe('Hello')

    testLogger.test('Alice sends message with positional parameters to Faber')

    const addRecord = await sendAndRecieve(aliceAgent, faberAgent, aliceConnection, {
      jsonrpc: '2.0',
      method: 'add',
      params: [2, 3, 7],
      id: 2,
    }, messageHandlers)

    expect((addRecord as DRPCResponseObject).result).toBe(12)

    testLogger.test('Alice sends message with keyed parameters to Faber')

    const parseFooRecord = await sendAndRecieve(aliceAgent, faberAgent, aliceConnection, {
      jsonrpc: '2.0',
      method: 'parseFoo',
      params: { foo: 'bar' },
      id: 3,
    }, messageHandlers)
    expect((parseFooRecord as DRPCResponseObject).result).toBe('bar')

    testLogger.test('Alice sends message with invalid method to Faber')

    const errorRecord = await sendAndRecieve(aliceAgent, faberAgent, aliceConnection, {
      jsonrpc: '2.0',
      method: 'error',
      id: 4,
    }, messageHandlers)
    expect((errorRecord as DRPCResponseObject).error).toBeDefined()
    expect((errorRecord as DRPCResponseObject).error?.code).toBe(DRPCErrorCode.METHOD_NOT_FOUND)
  })

  test('Alice sends Faber DRPC batch message', async () => {
    testLogger.test('Alice sends batch message to Faber')

    const batchRecord = await sendAndRecieveBatch(aliceAgent, faberAgent, aliceConnection, [
      { jsonrpc: '2.0', method: 'hello', id: 1 },
      { jsonrpc: '2.0', method: 'add', params: [2, 3, 7], id: 2 },
      { jsonrpc: '2.0', method: 'parseFoo', params: { foo: 'bar' }, id: 3 },
      { jsonrpc: '2.0', method: 'error', id: 4 },
    ], messageHandlers)
    expect(batchRecord as DRPCResponseObject[]).toHaveLength(4)
    expect((batchRecord as DRPCResponseObject[]).find((item) => item.id === 1)?.result).toBe('Hello')
    expect((batchRecord as DRPCResponseObject[]).find((item) => item.id === 2)?.result).toBe(12)
    expect((batchRecord as DRPCResponseObject[]).find((item) => item.id === 3)?.result).toBe('bar')
    expect((batchRecord as DRPCResponseObject[]).find((item) => item.id === 4)?.error).toBeDefined()
    expect((batchRecord as DRPCResponseObject[]).find((item) => item.id === 4)?.error?.code).toBe(
      DRPCErrorCode.METHOD_NOT_FOUND
    )
  })

  test('Alice sends Faber DRPC notification', async () => {
    testLogger.test('Alice sends notification to Faber')
    let notified = false
    messageHandlers.set('notify', async (_) => {
      notified = true
      return {}
    })
    const notifyRecord = await sendAndRecieve(aliceAgent, faberAgent, aliceConnection, {
      jsonrpc: '2.0',
      method: 'notify',
      id: null,
    }, messageHandlers)
    expect(notifyRecord).toMatchObject({})
    expect(notified).toBe(true)

    testLogger.test('Alice sends batch notification to Faber')
    notified = false

    const notifyBatchRecord = await sendAndRecieveBatch(aliceAgent, faberAgent, aliceConnection, [
      { jsonrpc: '2.0', method: 'hello', id: 1 },
      { jsonrpc: '2.0', method: 'notify', id: null },
    ], messageHandlers)
    expect(
      (notifyBatchRecord as (DRPCResponseObject | Record<string, never>)[]).find(
        (item) => (item as DRPCResponseObject)?.id === 1
      )
    ).toMatchObject({ jsonrpc: '2.0', result: 'Hello', id: 1 })
    expect(
      (notifyBatchRecord as (DRPCResponseObject | Record<string, never>)[]).find(
        (item) => !(item as DRPCResponseObject)?.id
      )
    ).toMatchObject({})
    expect(notified).toBe(true)
  })

  test('Alice sends Faber invalid DRPC message | Faber responds with invalid DRPC message', async () => {
    messageHandlers.set('hello', async (_) => {
      return [] as unknown as DRPCResponseObject
    })
    let error = false
    try {
      await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, 'test' as unknown as DRPCRequest)
    } catch {
      error = true
    }
    expect(error).toBe(true)
    aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {
      jsonrpc: '2.0',
      method: 'hello',
      id: 1,
    })
    const { connectionId, threadId, request } = await faberAgent.drpcMessages.nextDRPCRequest()
    const result = await handleMessageOrError(messageHandlers, request as DRPCRequestObject)
    let responseError = false
    try{
      await faberAgent.drpcMessages.sendDRPCResponse(connectionId, threadId, result as DRPCResponseObject)
    }catch{
      responseError = true
    }
    expect(responseError).toBe(true)
  })
})
