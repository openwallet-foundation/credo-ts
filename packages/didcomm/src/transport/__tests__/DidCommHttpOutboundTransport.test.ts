import type { AgentContext } from '@credo-ts/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { DidCommHttpOutboundTransport } from '../DidCommHttpOutboundTransport'

describe('DidCommHttpOutboundTransport', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears the request timeout when the request fails', async () => {
    vi.useFakeTimers()
    const logger = { debug: vi.fn(), error: vi.fn() }
    const agentContext = {
      config: { logger, agentDependencies: { fetch: vi.fn().mockRejectedValue(new Error('connection refused')) } },
      dependencyManager: { resolve: () => new DidCommModuleConfig() },
    } as unknown as AgentContext

    const transport = new DidCommHttpOutboundTransport()
    await transport.start(agentContext)

    await expect(
      transport.sendMessage({
        payload: { protected: '', iv: '', ciphertext: '', tag: '' },
        endpoint: 'https://example.com',
        responseRequested: false,
      })
    ).rejects.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })
})
