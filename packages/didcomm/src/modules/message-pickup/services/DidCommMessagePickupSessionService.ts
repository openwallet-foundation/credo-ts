import type { AgentContext } from '@credo-ts/core'
import type { TransportSessionRemovedEvent } from '../../../transport'
import type { MessagePickupLiveSessionRemovedEvent, DidCommMessagePickupLiveSessionSavedEvent } from '../DidCommMessagePickupEvents'
import type { DidCommMessagePickupSession as DidCommMessagePickupSession, DidCommMessagePickupSessionRole } from '../DidCommMessagePickupSession'

import { EventEmitter, InjectionSymbols, injectable, utils } from '@credo-ts/core'
import { type Subject, takeUntil } from 'rxjs'

import { DidCommTransportEventTypes } from '../../../transport'
import { DidCommMessagePickupEventTypes } from '../DidCommMessagePickupEvents'

/**
 * @internal
 * The Message Pickup session service keeps track of all {@link DidCommMessagePickupSession}
 *
 * It is initially intended for Message Holder/Mediator role, where only Live Mode sessions are
 * considered.
 */
@injectable()
export class DidCommMessagePickupSessionService {
  private sessions: DidCommMessagePickupSession[]

  public constructor() {
    this.sessions = []
  }

  public start(agentContext: AgentContext) {
    const stop$ = agentContext.dependencyManager.resolve<Subject<boolean>>(InjectionSymbols.Stop$)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    this.sessions = []

    eventEmitter
      .observable<TransportSessionRemovedEvent>(DidCommTransportEventTypes.DidCommTransportSessionRemoved)
      .pipe(takeUntil(stop$))
      .subscribe({
        next: (e) => {
          const connectionId = e.payload.session.connectionId
          if (connectionId) this.removeLiveSession(agentContext, { connectionId })
        },
      })
  }

  public getLiveSession(_agentContext: AgentContext, sessionId: string) {
    return this.sessions.find((session) => session.id === sessionId)
  }

  public getLiveSessionByConnectionId(
    _agentContext: AgentContext,
    options: { connectionId: string; role?: DidCommMessagePickupSessionRole }
  ) {
    const { connectionId, role } = options

    return this.sessions.find(
      (session) => session.connectionId === connectionId && (role === undefined || role === session.role)
    )
  }

  public saveLiveSession(
    agentContext: AgentContext,
    options: { connectionId: string; protocolVersion: string; role: DidCommMessagePickupSessionRole }
  ) {
    const { connectionId, protocolVersion, role } = options

    // First remove any live session for the given connection Id
    this.removeLiveSession(agentContext, { connectionId })

    const session = {
      id: utils.uuid(),
      connectionId,
      protocolVersion,
      role,
    }

    this.sessions.push(session)

    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    eventEmitter.emit<DidCommMessagePickupLiveSessionSavedEvent>(agentContext, {
      type: DidCommMessagePickupEventTypes.LiveSessionSaved,
      payload: {
        session,
      },
    })
  }

  public removeLiveSession(agentContext: AgentContext, options: { connectionId: string }) {
    const itemIndex = this.sessions.findIndex((session) => session.connectionId === options.connectionId)

    if (itemIndex > -1) {
      const [session] = this.sessions.splice(itemIndex, 1)
      const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

      eventEmitter.emit<MessagePickupLiveSessionRemovedEvent>(agentContext, {
        type: DidCommMessagePickupEventTypes.LiveSessionRemoved,
        payload: {
          session,
        },
      })
    }
  }
}
