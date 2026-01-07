import { AgentContext } from '@credo-ts/core'
import type { EnvelopeKeys } from '../../DidCommEnvelopeService'
import type { DidCommEncryptedMessage } from '../../types'

export interface DidCommTransportSessionRepository {
  addTransportSessionToSessionTable(session: DidCommTransportSession): Promise<void> | void
  findTransportSessionById(sessionId: string): Promise<DidCommTransportSession | undefined> | DidCommTransportSession | undefined
  findTransportSessionByConnectionId(
    connectionId: string
  ): Promise<DidCommTransportSession | undefined> | DidCommTransportSession | undefined
  findExistingSessionsForConnectionIdAndType(
    connectionId: string,
    type: string
  ): Promise<DidCommTransportSession | undefined>[] | (DidCommTransportSession | undefined)[]
  removeTransportSessionById(sessionId: string): Promise<void> | void
}

export interface DidCommTransportSessionTable {
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
  // inboundMessage?: AgentMessage
  hasReturnRoute?: boolean

  // A stored connection id used to find this session via the `TransportService` for a specific connection
  connectionId?: string

  // Send an encrypted message
  send(agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<void>

  // Close the session to prevent dangling sessions.
  close(): Promise<void>
}
