/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../../connections'
import type { DRPCRequest, DRPCResponseObject } from '../messages'

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

describe('DRPC Messages E2E', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
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
    ;[aliceConnection] = await makeConnection(aliceAgent, faberAgent)
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
      return { jsonrpc: '2.0', result: 'Hello', id: message.id }
    })
    const helloRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {
      jsonrpc: '2.0',
      method: 'hello',
      id: 1,
    })
    expect((helloRecord as DRPCResponseObject).result).toBe('Hello')

    testLogger.test('Alice sends message with positional parameters to Faber')
    faberAgent.drpcMessages.createDRPCMethodHandler('add', async (message) => {
      const operands = message.params as number[]
      const result = operands.reduce((a, b) => a + b, 0)
      return { jsonrpc: '2.0', result, id: message.id }
    })

    const addRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {
      jsonrpc: '2.0',
      method: 'add',
      params: [2, 3, 7],
      id: 2,
    })
    expect((addRecord as DRPCResponseObject).result).toBe(12)

    testLogger.test('Alice sends message with keyed parameters to Faber')
    faberAgent.drpcMessages.createDRPCMethodHandler('parseFoo', async (message) => {
      const params = message.params as { foo: string }
      return { jsonrpc: '2.0', result: params.foo, id: message.id }
    })

    testLogger.test('Alice sends message with invalid method to Faber')
    const parseFooRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {
      jsonrpc: '2.0',
      method: 'parseFoo',
      params: { foo: 'bar' },
      id: 3,
    })
    expect((parseFooRecord as DRPCResponseObject).result).toBe('bar')

    const errorRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {
      jsonrpc: '2.0',
      method: 'error',
      id: 4,
    })
    expect((errorRecord as DRPCResponseObject).error).toBeDefined()
    expect((errorRecord as DRPCResponseObject).error?.code).toBe(DRPCErrorCode.METHOD_NOT_FOUND)
  })

  test('Alice sends Faber DRPC batch message', async () => {
    testLogger.test('Alice sends batch message to Faber')
    faberAgent.drpcMessages.createDRPCMethodHandler('hello', async (message) => {
      return { jsonrpc: '2.0', result: 'Hello', id: message.id }
    })
    faberAgent.drpcMessages.createDRPCMethodHandler('add', async (message) => {
      const operands = message.params as number[]
      const result = operands.reduce((a, b) => a + b, 0)
      return { jsonrpc: '2.0', result, id: message.id }
    })
    faberAgent.drpcMessages.createDRPCMethodHandler('parseFoo', async (message) => {
      const params = message.params as { foo: string }
      return { jsonrpc: '2.0', result: params.foo, id: message.id }
    })

    const batchRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, [
      { jsonrpc: '2.0', method: 'hello', id: 1 },
      { jsonrpc: '2.0', method: 'add', params: [2, 3, 7], id: 2 },
      { jsonrpc: '2.0', method: 'parseFoo', params: { foo: 'bar' }, id: 3 },
      { jsonrpc: '2.0', method: 'error', id: 4 },
    ])
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
    faberAgent.drpcMessages.createDRPCMethodHandler('notify', async (_) => {
      notified = true
      return {}
    })
    const notifyRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {
      jsonrpc: '2.0',
      method: 'notify',
      id: null,
    })
    expect(notifyRecord).toMatchObject({})
    expect(notified).toBe(true)

    testLogger.test('Alice sends notification to Faber')
    notified = false

    faberAgent.drpcMessages.createDRPCMethodHandler('hello', async (message) => {
      return { jsonrpc: '2.0', result: 'Hello', id: message.id }
    })

    const notifyBatchRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, [
      { jsonrpc: '2.0', method: 'hello', id: 1 },
      { jsonrpc: '2.0', method: 'notify', id: null },
    ])
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
    faberAgent.drpcMessages.createDRPCMethodHandler('hello', async (_) => {
      return [] as unknown as DRPCResponseObject
    })
    let error = false
    try {
      await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, 'test' as unknown as DRPCRequest)
    } catch {
      error = true
    }
    expect(error).toBe(true)
    const errorRecord = await aliceAgent.drpcMessages.sendDRPCRequest(aliceConnection.id, {
      jsonrpc: '2.0',
      method: 'hello',
      id: 1,
    })
    expect(errorRecord as DRPCResponseObject).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: { code: DRPCErrorCode.INTERNAL_ERROR, message: 'Internal error', data: 'Error sending response' },
    })
  })
})
