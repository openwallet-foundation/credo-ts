import type { BaseEvent } from '@credo-ts/core'
import type { DidCommMessage } from './DidCommMessage'
import type { DidCommTransportSession } from './DidCommTransportService'
import type { DidCommOutboundMessageContext, OutboundMessageSendStatus } from './models'
import type { DidCommConnectionRecord } from './modules/connections/repository'
import type { DidCommEncryptedMessage } from './types'

export enum DidCommEventTypes {
  DidCommMessageReceived = 'DidCommMessageReceived',
  DidCommMessageProcessed = 'DidCommMessageProcessed',
  DidCommMessageProcessingFailed = 'DidCommMessageProcessingFailed',
  DidCommMessageSent = 'DidCommMessageSent',
  DidCommAckReceived = 'DidCommAckReceived',
}

export interface DidCommMessageReceivedEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommMessageReceived
  payload: {
    message: unknown
    connection?: DidCommConnectionRecord
    contextCorrelationId?: string
    receivedAt?: Date
    session?: DidCommTransportSession
  }
}

export interface DidCommMessageProcessedEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommMessageProcessed
  payload: {
    message: DidCommMessage
    connection?: DidCommConnectionRecord
    receivedAt?: Date
    encryptedMessage?: DidCommEncryptedMessage
    /** `true` once the message handler returned and every middleware called `next` */
    handled: boolean
  }
}

export interface DidCommMessageProcessingFailedEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommMessageProcessingFailed
  payload: {
    error: Error
    // The message exactly as received, whether encrypted or plaintext.
    message: unknown
    connection?: DidCommConnectionRecord
    contextCorrelationId?: string
    receivedAt?: Date
  }
}

export interface DidCommMessageSentEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommMessageSent
  payload: {
    message: DidCommOutboundMessageContext
    status: OutboundMessageSendStatus
  }
}

/**
 * Emitted for an inbound message that carries the DIDComm v2 `ack` header, before its handler runs.
 * A protocol that waits for an acknowledgement matches `acknowledgedMessageIds` against its own records.
 */
export interface DidCommAckReceivedEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommAckReceived
  payload: {
    message: DidCommMessage
    acknowledgedMessageIds: string[]
    connection?: DidCommConnectionRecord
  }
}
