import type { TransportSessionRemovedEvent } from '../../../transport'

import { Subject } from 'rxjs'

import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { AgentContext } from '../../../../../core/src/agent/context/AgentContext'
import { InjectionSymbols } from '../../../../../core/src/constants'
import { agentDependencies, getAgentContext } from '../../../../../core/tests/helpers'
import { AgentMessage } from '../../../AgentMessage'
import { TransportSession } from '../../../TransportService'
import { TransportEventTypes } from '../../../transport/TransportEventTypes'
import { MessagePickupSessionService } from '../services/MessagePickupSessionService'

describe('start listener remove live sessions', () => {
  let instance: MessagePickupSessionService
  let agentContext: AgentContext
  let stop$: Subject<boolean>
  let eventEmitter: EventEmitter

  beforeEach(() => {
    jest.resetAllMocks()

    stop$ = new Subject<boolean>()
    eventEmitter = new EventEmitter(agentDependencies, stop$)
    agentContext = getAgentContext({
      registerInstances: [
        [EventEmitter, eventEmitter],
        [InjectionSymbols.Stop$, stop$],
      ],
    })
    instance = new MessagePickupSessionService()
    jest.spyOn(instance, 'removeLiveSession').mockImplementation()
  })

  test('removes live session on WebSocket transport event', () => {
    instance.start(agentContext)

    const session: TransportSession = {
      id: '1',
      type: 'WebSocket',
      keys: {
        recipientKeys: [],
        routingKeys: [],
        senderKey: null,
      },
      inboundMessage: new AgentMessage(),
      connectionId: 'conn-123',
      send: jest.fn(),
      close: jest.fn(),
    }

    eventEmitter.emit<TransportSessionRemovedEvent>(agentContext, {
      type: TransportEventTypes.TransportSessionRemoved,
      payload: {
        session: session,
      },
    })

    expect(instance.removeLiveSession).toHaveBeenCalledWith(agentContext, {
      connectionId: 'conn-123',
    })
  })

  test('does not remove live session on non-WebSocket transport event', () => {
    instance.start(agentContext)

    const session: TransportSession = {
      id: '1',
      type: 'http',
      keys: {
        recipientKeys: [],
        routingKeys: [],
        senderKey: null,
      },
      inboundMessage: new AgentMessage(),
      connectionId: 'conn-123',
      send: jest.fn(),
      close: jest.fn(),
    }

    eventEmitter.emit<TransportSessionRemovedEvent>(agentContext, {
      type: TransportEventTypes.TransportSessionRemoved,
      payload: {
        session: session,
      },
    })

    expect(instance.removeLiveSession).not.toHaveBeenCalledWith(agentContext, {
      connectionId: 'conn-123',
    })
  })

  test('stops listening when stop$ emits', () => {
    instance.start(agentContext)

    stop$.next(true)

    const session: TransportSession = {
      id: '1',
      type: 'WebSocket',
      keys: {
        recipientKeys: [],
        routingKeys: [],
        senderKey: null,
      },
      inboundMessage: new AgentMessage(),
      connectionId: 'conn-123',
      send: jest.fn(),
      close: jest.fn(),
    }

    eventEmitter.emit<TransportSessionRemovedEvent>(agentContext, {
      type: TransportEventTypes.TransportSessionRemoved,
      payload: {
        session: session,
      },
    })

    expect(instance.removeLiveSession).not.toHaveBeenCalled()
  })
})
