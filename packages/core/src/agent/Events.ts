import type { ConnectionRecord } from '../modules/connections'
import type { AgentMessage } from './AgentMessage'

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
    connection?: ConnectionRecord
  }
}

export interface AgentMessageProcessedEvent extends BaseEvent {
  type: typeof AgentEventTypes.AgentMessageProcessed
  payload: {
    message: AgentMessage
    connection?: ConnectionRecord
  }
}
