import type { ConnectionRecord } from '../modules/connections'
import type { AgentMessage } from './AgentMessage'
import type { Observable } from 'rxjs'

import { filter } from 'rxjs'

export function filterContextCorrelationId(contextCorrelationId: string) {
  return <T extends BaseEvent>(source: Observable<T>) => {
    return source.pipe(filter((event) => event.metadata.contextCorrelationId === contextCorrelationId))
  }
}

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
