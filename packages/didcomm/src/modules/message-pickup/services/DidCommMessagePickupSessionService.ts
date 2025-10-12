import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, InjectionSymbols, injectable, utils } from '@credo-ts/core'
import { type Subject, takeUntil } from 'rxjs'
import type { DidCommTransportSessionRemovedEvent } from '../../../transport'
import { DidCommTransportEventTypes } from '../../../transport'
import type {
  DidCommMessagePickupLiveSessionSavedEvent,
  MessagePickupLiveSessionRemovedEvent,
} from '../DidCommMessagePickupEvents'
import { DidCommMessagePickupEventTypes } from '../DidCommMessagePickupEvents'
import type { DidCommMessagePickupSession, DidCommMessagePickupSessionRole } from '../DidCommMessagePickupSession'

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
      .observable<DidCommTransportSessionRemovedEvent>(DidCommTransportEventTypes.DidCommTransportSessionRemoved)
      .pipe(takeUntil(stop$))
      .subscribe({
        next: (e) => {
          // Find the live mode session that matches the transport session being removed
          const liveModeSession = this.sessions.find((session) => session.transportSessionId === e.payload.session.id)
          if (liveModeSession) this.removeLiveSession(agentContext, { connectionId: liveModeSession.connectionId })
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
    options: {
      connectionId: string
      protocolVersion: string
      role: DidCommMessagePickupSessionRole
      transportSessionId: string
    }
  ) {
    const { connectionId, protocolVersion, role, transportSessionId } = options

    // First remove any live session for the given connection Id
    this.removeLiveSession(agentContext, { connectionId })

    const session: DidCommMessagePickupSession = {
      id: utils.uuid(),
      connectionId,
      protocolVersion,
      role,
      transportSessionId,
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
