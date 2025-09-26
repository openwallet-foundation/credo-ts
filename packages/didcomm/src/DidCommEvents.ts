import type { BaseEvent } from '@credo-ts/core'
import type { DidCommMessage } from './DidCommMessage'
import type { DidCommTransportSession } from './DidCommTransportService'
import type { DidCommOutboundMessageContext, OutboundMessageSendStatus } from './models'
import type { DidCommConnectionRecord } from './modules/connections/repository'
import type { DidCommEncryptedMessage } from './types'

export enum DidCommEventTypes {
  DidCommMessageReceived = 'DidCommMessageReceived',
  DidCommMessageProcessed = 'DidCommMessageProcessed',
  DidCommMessageSent = 'DidCommMessageSent',
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
  }
}

export interface DidCommMessageSentEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommMessageSent
  payload: {
    message: DidCommOutboundMessageContext
    status: OutboundMessageSendStatus
  }
}
