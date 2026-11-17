import { setTimeout as sleep } from 'node:timers/promises'
import type { EventEmitter as NativeEventEmitter } from 'events'
import { Subject } from 'rxjs'

import { agentDependencies, getAgentContext } from '../../../tests/helpers'
import { ConsoleLogger, LogLevel } from '../../logger'
import { AgentConfig } from '../AgentConfig'
import { EventEmitter } from '../EventEmitter'

const mockOn = vi.fn()
const mockOff = vi.fn()
const mock = vi.fn(function () {
  return { on: mockOn, off: mockOff }
})

const eventEmitter = new EventEmitter(
  { ...agentDependencies, EventEmitterClass: mock as unknown as typeof NativeEventEmitter },
  new Subject()
)

describe('EventEmitter', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('emit', () => {
    const waitUntil = vi.fn()
    const logger = new ConsoleLogger(LogLevel.Off)
    const agentContext = getAgentContext({ agentConfig: new AgentConfig({ logger, waitUntil }, agentDependencies) })
    const emitter = new EventEmitter(agentDependencies, new Subject())
    const event = { type: 'some-event', payload: { some: 'payload' } }

    test('calls the listeners with the event and its metadata', async () => {
      const listener = vi.fn()
      emitter.on('some-event', listener)

      await emitter.emit(agentContext, event)

      expect(listener).toHaveBeenCalledWith({
        ...event,
        metadata: { contextCorrelationId: agentContext.contextCorrelationId },
      })
      expect(waitUntil).not.toHaveBeenCalled()
      emitter.off('some-event', listener)
    })

    test('passes the promises of async listeners to waitUntil and settles once they have', async () => {
      let finished = false
      const listener = async () => {
        await sleep(10)
        finished = true
      }
      emitter.on('some-event', listener)

      const emitted = emitter.emit(agentContext, event)
      expect(finished).toBe(false)
      expect(waitUntil).toHaveBeenCalledOnce()

      await emitted
      expect(finished).toBe(true)
      emitter.off('some-event', listener)
    })

    test('resolves when an async listener rejects, and logs the error', async () => {
      const error = new Error('Listener failed')
      const listener = async () => {
        throw error
      }
      const loggerError = vi.spyOn(logger, 'error')
      emitter.on('some-event', listener)

      await expect(emitter.emit(agentContext, event)).resolves.toBeUndefined()
      // The promise handed to waitUntil doesn't reject
      await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined()
      expect(loggerError).toHaveBeenCalledWith(expect.any(String), { error })
      emitter.off('some-event', listener)
    })
  })

  describe('on', () => {
    test("calls 'on' on native event emitter instance", () => {
      const listener = vi.fn()
      eventEmitter.on('some-event', listener)

      expect(mockOn).toHaveBeenCalledWith('some-event', listener)
    })
  })
  describe('off', () => {
    test("calls 'off' on native event emitter instance", () => {
      const listener = vi.fn()
      eventEmitter.off('some-event', listener)

      expect(mockOff).toHaveBeenCalledWith('some-event', listener)
    })
  })
})
