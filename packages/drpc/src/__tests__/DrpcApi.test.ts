import type { AgentContext } from '@credo-ts/core'
import type { DidCommConnectionService, DidCommMessageSender } from '@credo-ts/didcomm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrpcApi } from '../DrpcApi'
import { DrpcRole } from '../models'
import type { DrpcRecord } from '../repository/DrpcRecord'
import type { DrpcService } from '../services'

type Listener = (event: { drpcMessageRecord: DrpcRecord; removeListener: () => void }) => void

describe('DrpcApi', () => {
  let requestListener: Listener | undefined
  let responseListener: Listener | undefined
  let api: DrpcApi

  beforeEach(() => {
    vi.useFakeTimers()
    const drpcMessageService = {
      createRequestListener: (listener: Listener) => {
        requestListener = listener
        return vi.fn()
      },
      createResponseListener: (listener: Listener) => {
        responseListener = listener
        return vi.fn()
      },
      createRequestMessage: vi.fn().mockResolvedValue({
        requestMessage: { id: 'request-id' },
        record: {},
      }),
    } as unknown as DrpcService
    const connectionService = {
      getById: vi.fn().mockResolvedValue({ id: 'connection-id' }),
    } as unknown as DidCommConnectionService
    const messageSender = { sendMessage: vi.fn() } as unknown as DidCommMessageSender

    api = new DrpcApi(drpcMessageService, messageSender, connectionService, {} as AgentContext)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears the timeout when a request is received', async () => {
    const received = api.recvRequest(60_000)
    expect(vi.getTimerCount()).toBe(1)
    requestListener?.({
      drpcMessageRecord: {
        request: { jsonrpc: '2.0', method: 'hello', id: 1 },
        role: DrpcRole.Server,
        connectionId: 'connection-id',
        threadId: 'thread-id',
      } as DrpcRecord,
      removeListener: vi.fn(),
    })

    await expect(received).resolves.toMatchObject({ request: { method: 'hello' } })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the timeout when a response is received', async () => {
    const waitForResponse = await api.sendRequest('connection-id', { jsonrpc: '2.0', method: 'hello', id: 1 })
    const received = waitForResponse(60_000)
    expect(vi.getTimerCount()).toBe(1)
    responseListener?.({
      drpcMessageRecord: {
        response: { jsonrpc: '2.0', result: 'world', id: 1 },
        threadId: 'request-id',
      } as DrpcRecord,
      removeListener: vi.fn(),
    })

    await expect(received).resolves.toMatchObject({ result: 'world' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resolves with undefined when no request arrives before the timeout', async () => {
    const received = api.recvRequest(1000)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(received).resolves.toBeUndefined()
  })
})
