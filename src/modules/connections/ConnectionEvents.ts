import { BaseEvent } from '../../agent/Events'

import { ConnectionState } from './models/ConnectionState'
import { ConnectionRecord } from './repository/ConnectionRecord'

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
