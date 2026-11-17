import { AsyncLocalStorage } from 'node:async_hooks'
import { setTimeout as sleep } from 'node:timers/promises'
import { Agent } from '@credo-ts/core'
import { getAgentOptions } from '../../../core/tests/helpers'
import type { DidCommMessageReceivedEvent } from '../DidCommEvents'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommMessageReceiver } from '../DidCommMessageReceiver'
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

  test('processes received messages one at a time, each in the async context it was received in', async () => {
    const agent = new Agent(
      getAgentOptions('DidCommModule message queue', {}, undefined, undefined, { requireDidcomm: true })
    )
    await agent.initialize()

    const storage = new AsyncLocalStorage<string>()
    const steps: string[] = []
    vi.spyOn(agent.dependencyManager.resolve(DidCommMessageReceiver), 'receiveMessage').mockImplementation(async () => {
      steps.push(`start ${storage.getStore()}`)
      await sleep(10)
      steps.push(`end ${storage.getStore()}`)
    })

    const receive = (name: string) =>
      storage.run(name, () =>
        agent.events.emit<DidCommMessageReceivedEvent>(agent.context, {
          type: DidCommEventTypes.DidCommMessageReceived,
          payload: { message: {} },
        })
      )
    await Promise.all([receive('first'), receive('second')])

    expect(steps).toEqual(['start first', 'end first', 'start second', 'end second'])

    await agent.shutdown()
  })
})
