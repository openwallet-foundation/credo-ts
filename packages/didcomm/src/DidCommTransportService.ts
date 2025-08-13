import type { DidDocument } from '@credo-ts/core'
import type { EnvelopeKeys } from './DidCommEnvelopeService'
import type { DidCommMessage } from './DidCommMessage'
import type { TransportSessionRemovedEvent, TransportSessionSavedEvent } from './transport'
import type { EncryptedDidCommMessage } from './types'

import { AgentContext, CredoError, EventEmitter, injectable } from '@credo-ts/core'

import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import { DidCommTransportEventTypes } from './transport'

@injectable()
export class DidCommTransportService {
  public transportSessionTable: TransportSessionTable = {}
  private agentContext: AgentContext
  private eventEmitter: EventEmitter

  public constructor(agentContext: AgentContext, eventEmitter: EventEmitter) {
    this.agentContext = agentContext
    this.eventEmitter = eventEmitter
  }

  public saveSession(session: DidCommTransportSession) {
    if (session.connectionId) {
      const oldSessions = this.getExistingSessionsForConnectionIdAndType(session.connectionId, session.type)
      for (const oldSession of oldSessions) {
        if (oldSession && oldSession.id !== session.id) {
          this.removeSession(oldSession)
        }
      }
    }
    this.transportSessionTable[session.id] = session

    this.eventEmitter.emit<TransportSessionSavedEvent>(this.agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionSaved,
      payload: {
        session,
      },
    })
  }

  public findSessionByConnectionId(connectionId: string) {
    return Object.values(this.transportSessionTable).find((session) => session?.connectionId === connectionId)
  }

  public setConnectionIdForSession(sessionId: string, connectionId: string) {
    const session = this.findSessionById(sessionId)
    if (!session) {
      throw new CredoError(`Session not found with id ${sessionId}`)
    }
    session.connectionId = connectionId
    this.saveSession(session)
  }

  public hasInboundEndpoint(didDocument: DidDocument): boolean {
    return Boolean(didDocument.didCommServices?.find((s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE))
  }

  public findSessionById(sessionId: string) {
    return this.transportSessionTable[sessionId]
  }

  public removeSession(session: DidCommTransportSession) {
    delete this.transportSessionTable[session.id]
    this.eventEmitter.emit<TransportSessionRemovedEvent>(this.agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionRemoved,
      payload: {
        session,
      },
    })
  }

  private getExistingSessionsForConnectionIdAndType(connectionId: string, type: string) {
    return Object.values(this.transportSessionTable).filter(
      (session) => session?.connectionId === connectionId && session.type === type
    )
  }
}

interface TransportSessionTable {
  [sessionId: string]: DidCommTransportSession | undefined
}

// In the framework Transport sessions are used for communication. A session is
// associated with a connection and it can be reused when we want to respond to
// a message. If the message, for example, does not contain any way to reply to
// this message, the session should be closed. When a new sequence of messages
// starts it can be used again. A session will be deleted when a WebSocket
// closes, for the WsTransportSession that is.
export interface DidCommTransportSession {
  // unique identifier for a transport session. This can a uuid, or anything else, as long
  // as it uniquely identifies a transport.
  id: string

  // The type is something that explicitly defines the transport type. For WebSocket it would
  // be "WebSocket" and for HTTP it would be "HTTP".
  type: string

  // The enveloping keys that can be used during the transport. This is used so the framework
  // does not have to look up the associated keys for sending a message.
  keys?: EnvelopeKeys

  // A received message that will be used to check whether it has any return routing.
  inboundMessage?: DidCommMessage

  // A stored connection id used to find this session via the `DidCommTransportService` for a specific connection
  connectionId?: string

  // Send an encrypted message
  send(agentContext: AgentContext, encryptedMessage: EncryptedDidCommMessage): Promise<void>

  // Close the session to prevent dangling sessions.
  close(): Promise<void>
}
