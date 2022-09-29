import type { ConnectionRecord } from '..'
import type { DIDCommMessage } from './didcomm'

export enum AgentEventTypes {
  AgentMessageReceived = 'AgentMessageReceived',
  AgentMessageProcessed = 'AgentMessageProcessed',
}

export interface BaseEvent {
  type: string
  payload: Record<string, unknown>
}

export interface AgentMessageReceivedEvent extends BaseEvent {
  type: typeof AgentEventTypes.AgentMessageReceived
  payload: {
    message: unknown
  }
}

export interface AgentMessageProcessedEvent extends BaseEvent {
  type: typeof AgentEventTypes.AgentMessageProcessed
  payload: {
    message: DIDCommMessage
    connection?: ConnectionRecord
  }
}
