import type { DidDocument } from '@credo-ts/core'
import type { TransportSession, TransportSessionRemovedEvent, TransportSessionSavedEvent } from './transport'
import { TransportSessionRepository } from './transport'

import { AgentContext, CredoError, EventEmitter, injectable } from '@credo-ts/core'

import { DidCommModuleConfig } from './DidCommModuleConfig'
import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import { TransportEventTypes } from './transport'

@injectable()
export class TransportService {
  private agentContext: AgentContext
  private eventEmitter: EventEmitter
  private transportSessionRepository: TransportSessionRepository

  public constructor(agentContext: AgentContext, eventEmitter: EventEmitter, didCommModuleConfig: DidCommModuleConfig) {
    this.agentContext = agentContext
    this.eventEmitter = eventEmitter
    this.transportSessionRepository = didCommModuleConfig.transportSessionRepository
  }

  public async saveSession(session: TransportSession) {
    if (session.connectionId) {
      const oldSessions = await this.getExistingSessionsForConnectionIdAndType(session.connectionId, session.type)

      for await (const oldSession of oldSessions) {
        if (oldSession && oldSession.id !== session.id) {
          await this.removeSession(oldSession)
        }
      }
    }
    await this.transportSessionRepository.addTransportSessionToSessionTable(session)

    this.eventEmitter.emit<TransportSessionSavedEvent>(this.agentContext, {
      type: TransportEventTypes.TransportSessionSaved,
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

  public async removeSession(session: TransportSession) {
    await this.transportSessionRepository.removeTransportSessionById(session.id)
    this.eventEmitter.emit<TransportSessionRemovedEvent>(this.agentContext, {
      type: TransportEventTypes.TransportSessionRemoved,
      payload: {
        session,
      },
    })
  }

  private async getExistingSessionsForConnectionIdAndType(connectionId: string, type: string) {
    return await this.transportSessionRepository.findExistingSessionsForConnectionIdAndType(connectionId, type)
  }
}
