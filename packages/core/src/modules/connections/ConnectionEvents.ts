import type { BaseEvent } from '../../agent/Events'
import type { ConnectionState } from './models/ConnectionState'
import type { ConnectionRecord } from './repository/ConnectionRecord'

export enum ConnectionEventTypes {
  ConnectionStateChanged = 'ConnectionStateChanged',
  ConnectionDeleted = 'ConnectionDeleted',
}

export interface ConnectionStateChangedEvent extends BaseEvent {
  type: typeof ConnectionEventTypes.ConnectionStateChanged
  payload: {
    connectionRecord: ConnectionRecord
    previousState: ConnectionState | null
  }
}
export interface ConnectionDeletedEvent extends BaseEvent {
  type: typeof ConnectionEventTypes.ConnectionDeleted
  payload: {
    connectionRecord: ConnectionRecord
  }
}
