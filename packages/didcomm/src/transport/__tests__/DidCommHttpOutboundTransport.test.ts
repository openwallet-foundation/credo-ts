import type { AgentContext } from '@credo-ts/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import type { DidCommOutboundPackage } from '../../types'
import { DidCommHttpOutboundTransport } from '../DidCommHttpOutboundTransport'

describe('DidCommHttpOutboundTransport', () => {
  const logger = { debug: vi.fn(), error: vi.fn() }
  const outboundPackage = (responseRequested: boolean): DidCommOutboundPackage => ({
    payload: { protected: '', iv: '', ciphertext: '', tag: '' },
    endpoint: 'https://example.com',
    responseRequested,
  })

  let fetch: ReturnType<typeof vi.fn>
  let transport: DidCommHttpOutboundTransport

  beforeEach(async () => {
    vi.useFakeTimers()
    fetch = vi.fn()
    const agentContext = {
      config: { logger, agentDependencies: { fetch } },
      dependencyManager: { resolve: () => new DidCommModuleConfig() },
    } as unknown as AgentContext
    transport = new DidCommHttpOutboundTransport()
    await transport.start(agentContext)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('sets a request timeout and clears it when the request fails', async () => {
    let rejectFetch: (error: Error) => void = () => {}
    fetch.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectFetch = reject
      })
    )

    const sending = transport.sendMessage(outboundPackage(false))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(vi.getTimerCount()).toBe(1)

    rejectFetch(new Error('connection refused'))
    await expect(sending).rejects.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the request timeout when the request succeeds', async () => {
    fetch.mockResolvedValue({ status: 200, text: async () => '' })

    await expect(transport.sendMessage(outboundPackage(false))).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('still aborts a request that gets no response within the timeout', async () => {
    fetch.mockImplementation(
      (_endpoint: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        })
    )

    const sending = transport.sendMessage(outboundPackage(true))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(15000)

    await expect(sending).resolves.toBeUndefined()
    expect(logger.debug).toHaveBeenCalledWith(
      'Request was aborted due to timeout. Not throwing error due to return routing on sent message'
    )
    expect(vi.getTimerCount()).toBe(0)
  })
})
