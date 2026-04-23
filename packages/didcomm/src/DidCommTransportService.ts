import type { DidDocument } from '@credo-ts/core'
import type { DidCommTransportSession, DidCommTransportSessionRepository } from './transport'

import { AgentContext, CredoError, EventEmitter, injectable } from '@credo-ts/core'

import { DidCommModuleConfig } from './DidCommModuleConfig'
import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import type { DidCommTransportSessionRemovedEvent, DidCommTransportSessionSavedEvent } from './transport'
import { DidCommTransportEventTypes } from './transport'

@injectable()
export class DidCommTransportService {
  private agentContext: AgentContext
  private eventEmitter: EventEmitter
  private transportSessionRepository: DidCommTransportSessionRepository

  public constructor(agentContext: AgentContext, eventEmitter: EventEmitter, didCommModuleConfig: DidCommModuleConfig) {
    this.agentContext = agentContext
    this.eventEmitter = eventEmitter
    this.transportSessionRepository = didCommModuleConfig.transportSessionRepository
  }

  public async saveSession(session: DidCommTransportSession) {
    if (session.connectionId) {
      const oldSessions = await this.getExistingSessionsForConnectionIdAndType(session.connectionId, session.type)

      for await (const oldSession of oldSessions) {
        if (oldSession && oldSession.id !== session.id) {
          await this.removeSession(oldSession)
        }
      }
    }
    await this.transportSessionRepository.addTransportSessionToSessionTable(session)

    this.eventEmitter.emit<DidCommTransportSessionSavedEvent>(this.agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionSaved,
      payload: {
        session,
      },
    })
  }

  public async findSessionByConnectionId(connectionId: string) {
    return await this.transportSessionRepository.findTransportSessionByConnectionId(connectionId)
  }

  public async setConnectionIdForSession(sessionId: string, connectionId: string) {
    const session = await this.findSessionById(sessionId)
    if (!session) {
      throw new CredoError(`Session not found with id ${sessionId}`)
    }
    session.connectionId = connectionId
    await this.saveSession(session)
  }

  public hasInboundEndpoint(didDocument: DidDocument): boolean {
    return Boolean(didDocument.didCommServices?.find((s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE))
  }

  public async findSessionById(sessionId: string) {
    return await this.transportSessionRepository.findTransportSessionById(sessionId)
  }

  public async removeSession(session: DidCommTransportSession) {
    await this.transportSessionRepository.removeTransportSessionById(session.id)

    this.eventEmitter.emit<DidCommTransportSessionRemovedEvent>(this.agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionRemoved,
      payload: {
        session,
      },
    })
  }

  private async getExistingSessionsForConnectionIdAndType(connectionId: string, type: string) {
    return await this.transportSessionRepository.findExistingSessionsForConnectionIdAndType(connectionId, type)
  }
}
