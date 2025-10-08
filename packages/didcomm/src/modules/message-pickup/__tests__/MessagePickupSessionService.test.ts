import type { DidCommTransportSessionRemovedEvent } from '../../../transport'

import { Subject } from 'rxjs'

import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { AgentContext } from '../../../../../core/src/agent/context/AgentContext'
import { InjectionSymbols } from '../../../../../core/src/constants'
import { agentDependencies, getAgentContext } from '../../../../../core/tests/helpers'
import { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommTransportSession } from '../../../DidCommTransportService'
import { DidCommTransportEventTypes } from '../../../transport/DidCommTransportEventTypes'
import { DidCommMessagePickupSessionRole } from '../DidCommMessagePickupSession'
import { DidCommMessagePickupSessionService } from '../services/DidCommMessagePickupSessionService'

describe('start listener remove live sessions', () => {
  let instance: DidCommMessagePickupSessionService
  let agentContext: AgentContext
  let stop$: Subject<boolean>
  let eventEmitter: EventEmitter

  beforeEach(() => {
    vi.resetAllMocks()

    stop$ = new Subject<boolean>()
    eventEmitter = new EventEmitter(agentDependencies, stop$)
    agentContext = getAgentContext({
      registerInstances: [
        [EventEmitter, eventEmitter],
        [InjectionSymbols.Stop$, stop$],
      ],
    })
    instance = new DidCommMessagePickupSessionService()
    vi.spyOn(instance, 'removeLiveSession').mockImplementation(() => {})
  })

  test('removes live session on related transport event', () => {
    instance.start(agentContext)

    const session: DidCommTransportSession = {
      id: '1',
      type: 'WebSocket',
      keys: {
        recipientKeys: [],
        routingKeys: [],
        senderKey: null,
      },
      inboundMessage: new DidCommMessage(),
      connectionId: 'conn-123',
      send: vi.fn(),
      close: vi.fn(),
    }

    // Add the session to the instance
    instance.saveLiveSession(agentContext, {
      connectionId: 'conn-123',
      protocolVersion: 'v2',
      role: DidCommMessagePickupSessionRole.MessageHolder,
      transportSessionId: '1',
    })

    eventEmitter.emit<DidCommTransportSessionRemovedEvent>(agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionRemoved,
      payload: {
        session: session,
      },
    })

    expect(instance.removeLiveSession).toHaveBeenCalledWith(agentContext, {
      connectionId: 'conn-123',
    })
  })

  test('does not remove live session on non-related transport event', () => {
    instance.start(agentContext)

    const session: DidCommTransportSession = {
      id: '1',
      type: 'WebSocket',
      keys: {
        recipientKeys: [],
        routingKeys: [],
        senderKey: null,
      },
      inboundMessage: new DidCommMessage(),
      connectionId: 'conn-123',
      send: vi.fn(),
      close: vi.fn(),
    }

    eventEmitter.emit<DidCommTransportSessionRemovedEvent>(agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionRemoved,
      payload: {
        session,
      },
    })

    expect(instance.removeLiveSession).not.toHaveBeenCalled()
  })

  test('stops listening when stop$ emits', () => {
    instance.start(agentContext)

    stop$.next(true)

    const session: DidCommTransportSession = {
      id: '1',
      type: 'WebSocket',
      keys: {
        recipientKeys: [],
        routingKeys: [],
        senderKey: null,
      },
      inboundMessage: new DidCommMessage(),
      connectionId: 'conn-123',
      send: vi.fn(),
      close: vi.fn(),
    }

    eventEmitter.emit<DidCommTransportSessionRemovedEvent>(agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionRemoved,
      payload: {
        session: session,
      },
    })

    expect(instance.removeLiveSession).not.toHaveBeenCalled()
  })
})
