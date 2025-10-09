import type { EventEmitter as NativeEventEmitter } from 'events'
import { Subject } from 'rxjs'

import { agentDependencies, getAgentContext } from '../../../tests/helpers'
import { EventEmitter } from '../EventEmitter'

const mockEmit = vi.fn()
const mockOn = vi.fn()
const mockOff = vi.fn()
const mock = vi.fn().mockImplementation(() => {
  return { emit: mockEmit, on: mockOn, off: mockOff }
})

const eventEmitter = new EventEmitter(
  { ...agentDependencies, EventEmitterClass: mock as unknown as typeof NativeEventEmitter },
  new Subject()
)
const agentContext = getAgentContext({})

describe('EventEmitter', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('emit', () => {
    test("calls 'emit' on native event emitter instance", () => {
      eventEmitter.emit(agentContext, {
        payload: { some: 'payload' },
        type: 'some-event',
      })

      expect(mockEmit).toHaveBeenCalledWith('some-event', {
        payload: { some: 'payload' },
        type: 'some-event',
        metadata: {
          contextCorrelationId: agentContext.contextCorrelationId,
        },
      })
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
