import { Agent } from '@credo-ts/core'
import { getAgentOptions } from '../../../core/tests/helpers'
import type { DidCommQueueTransportRepository } from '../transport'

describe('DidCommModule', () => {
  test('starts the configured queue transport repository on initialize', async () => {
    const queueTransportRepository: DidCommQueueTransportRepository = {
      start: vi.fn(),
      getAvailableMessageCount: vi.fn(),
      takeFromQueue: vi.fn(),
      addMessage: vi.fn(),
      removeMessages: vi.fn(),
    }
    const agent = new Agent(
      getAgentOptions('DidCommModule queue start', { queueTransportRepository }, undefined, undefined, {
        requireDidcomm: true,
      })
    )

    await agent.initialize()

    expect(queueTransportRepository.start).toHaveBeenCalledExactlyOnceWith(agent.context)

    await agent.shutdown()
  })
})
