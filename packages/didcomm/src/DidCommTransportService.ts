import type { DidDocument } from '@credo-ts/core'
import { AgentContext, CredoError, EventEmitter, injectable } from '@credo-ts/core'
import { DID_COMM_TRANSPORT_QUEUE } from './constants'
import type { EnvelopeKeys } from './DidCommEnvelopeService'
import type { DidCommMessage } from './DidCommMessage'
import type { DidCommTransportSessionRemovedEvent, DidCommTransportSessionSavedEvent } from './transport'
import { DidCommTransportEventTypes } from './transport'
import type { DidCommEncryptedMessage } from './types'
import type { DidCommVersion } from './util/didcommVersion'

@injectable()
export class DidCommTransportService {
  // A Map keeps insertion order for every key, which the lookups rely on to find the most recent session
  public transportSessionTable = new Map<string, DidCommTransportSession>()
  private agentContext: AgentContext
  private eventEmitter: EventEmitter

  public constructor(agentContext: AgentContext, eventEmitter: EventEmitter) {
    this.agentContext = agentContext
    this.eventEmitter = eventEmitter
  }

  public saveSession(session: DidCommTransportSession) {
    // Single response sessions of the connection are kept. Each concurrent request has its own session,
    // and the reply to a request must go to the session it came in on. A long-lived session of the same
    // type is replaced by a new one, as it may be half open after the client reconnected. Closed ones are dropped
    // here, in case their transport didn't remove them.
    if (session.connectionId) {
      for (const other of [...this.transportSessionTable.values()]) {
        if (other.connectionId !== session.connectionId || other.id === session.id) continue
        const isReplaced = !session.isSingleResponse && !other.isSingleResponse && other.type === session.type
        if (other.isClosed || isReplaced) this.removeSession(other)
      }
    }
    // Removed first, so a session that is saved again becomes the most recent one
    this.transportSessionTable.delete(session.id)
    this.transportSessionTable.set(session.id, session)

    this.eventEmitter.emit<DidCommTransportSessionSavedEvent>(this.agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionSaved,
      payload: {
        session,
      },
    })
  }

  /**
   * The most recently saved session of the connection that is still open. A long-lived session goes
   * before one that answers a single request, so the response to that request is left for its own
   * reply. Closed sessions are removed, also those of other connections.
   *
   * @param options.includeSingleResponse set to false to skip sessions that answer a single request
   */
  public findSessionByConnectionId(connectionId: string, { includeSingleResponse = true } = {}) {
    let longLived: DidCommTransportSession | undefined
    let singleResponse: DidCommTransportSession | undefined
    for (const session of [...this.transportSessionTable.values()].reverse()) {
      // Clean up old sessions that were not removed by their transport
      if (session.isClosed) this.removeSession(session)
      else if (session.connectionId === connectionId) {
        if (session.isSingleResponse) singleResponse ??= session
        else longLived ??= session
      }
    }
    return longLived ?? (includeSingleResponse ? singleResponse : undefined)
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
    return Boolean(
      [...didDocument.didCommServices, ...didDocument.didCommV2Services].find(
        (s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE
      )
    )
  }

  public findSessionById(sessionId: string) {
    return this.transportSessionTable.get(sessionId)
  }

  public removeSession(session: DidCommTransportSession) {
    // Transports and lookups can both remove a session, which should emit a single event
    if (!this.transportSessionTable.delete(session.id)) return
    this.eventEmitter.emit<DidCommTransportSessionRemovedEvent>(this.agentContext, {
      type: DidCommTransportEventTypes.DidCommTransportSessionRemoved,
      payload: {
        session,
      },
    })
  }
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

  // The envelope version of the inbound message this session was stored for. A reply over this
  // session uses the same version, even when the connection record says otherwise, because the
  // peer may have fallen back to another version for this exchange.
  didcommVersion?: DidCommVersion

  // A received message that will be used to check whether it has any return routing.
  inboundMessage?: DidCommMessage

  // Whether a message has already been received over this session. Set by the `DidCommMessageReceiver`.
  hasReceivedMessage?: boolean

  // A stored connection id used to find this session via the `DidCommTransportService` for a specific connection
  connectionId?: string

  // Whether the session can no longer be used to send a message, for example because the socket closed
  // or the request was already answered. Not set means the session is open.
  isClosed?: boolean

  // Whether the session can only carry the response to the request it was created for, like an HTTP
  // session. Such a session is not used for the reply to another inbound message.
  isSingleResponse?: boolean

  // Send an encrypted message
  send(agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<void>

  // Close the session to prevent dangling sessions.
  close(): Promise<void>
}
