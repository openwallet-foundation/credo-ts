import type { BaseEvent } from '@credo-ts/core'
import type { DidCommMessage } from './DidCommMessage'
import type { DidCommTransportSession } from './DidCommTransportService'
import type { OutboundDidCommMessageContext, OutboundMessageSendStatus } from './models'
import type { ConnectionRecord } from './modules/connections/repository'
import type { EncryptedDidCommMessage } from './types'

export enum DidCommEventTypes {
  DidCommMessageReceived = 'DidCommMessageReceived',
  DidCommMessageProcessed = 'DidCommMessageProcessed',
  DidCommMessageSent = 'DidCommMessageSent',
}

export interface DidCommMessageReceivedEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommMessageReceived
  payload: {
    message: unknown
    connection?: ConnectionRecord
    contextCorrelationId?: string
    receivedAt?: Date
    session?: DidCommTransportSession
  }
}

export interface DidCommMessageProcessedEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommMessageProcessed
  payload: {
    message: DidCommMessage
    connection?: ConnectionRecord
    receivedAt?: Date
    encryptedMessage?: EncryptedDidCommMessage
  }
}

export interface DidCommMessageSentEvent extends BaseEvent {
  type: typeof DidCommEventTypes.DidCommMessageSent
  payload: {
    message: OutboundDidCommMessageContext
    status: OutboundMessageSendStatus
  }
}
