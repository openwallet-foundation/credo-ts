import { BaseEvent } from '../../agent/Events'
import { ConnectionRecord } from './repository/ConnectionRecord'
import { ConnectionState } from './models/ConnectionState'

export enum ConnectionEventTypes {
  ConnectionStateChanged = 'ConnectionStateChanged',
}

export interface ConnectionStateChangedEvent extends BaseEvent {
  type: typeof ConnectionEventTypes.ConnectionStateChanged
  payload: {
    connectionRecord: ConnectionRecord
    previousState: ConnectionState | null
  }
}
