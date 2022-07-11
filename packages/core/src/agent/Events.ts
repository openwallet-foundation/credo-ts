import type { ConnectionRecord } from '../modules/connections'
import type { AgentMessage } from './AgentMessage'

export enum AgentEventTypes {
  AgentMessageReceived = 'AgentMessageReceived',
  AgentMessageProcessed = 'AgentMessageProcessed',
}

export interface EventMetadata {
  contextCorrelationId: string
}

export interface BaseEvent {
  type: string
  payload: Record<string, unknown>
  metadata: EventMetadata
}

export interface AgentMessageReceivedEvent extends BaseEvent {
  type: typeof AgentEventTypes.AgentMessageReceived
  payload: {
    message: unknown
    connection?: ConnectionRecord
    contextCorrelationId?: string
  }
}

export interface AgentMessageProcessedEvent extends BaseEvent {
  type: typeof AgentEventTypes.AgentMessageProcessed
  payload: {
    message: AgentMessage
    connection?: ConnectionRecord
  }
}
