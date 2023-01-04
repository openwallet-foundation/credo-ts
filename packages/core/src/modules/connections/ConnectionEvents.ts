import type { BaseEvent } from '../../agent/Events'
import type { DidExchangeState } from './models'
import type { ConnectionRecord } from './repository/ConnectionRecord'

export enum ConnectionEventTypes {
  ConnectionStateChanged = 'ConnectionStateChanged',
}

export interface ConnectionStateChangedEvent extends BaseEvent {
  type: typeof ConnectionEventTypes.ConnectionStateChanged
  payload: {
    connectionRecord: ConnectionRecord
    previousState: DidExchangeState | null
  }
}

export enum TrustPingEventTypes {
  PingReceived = 'PingReceived',
  PingResponseReceived = 'PingResponseReceived',
}

export interface PingReceivedEvent extends BaseEvent {
  type: typeof TrustPingEventTypes.PingReceived
  payload: {
    from: string
  }
}

export interface PingResponseReceivedEvent extends BaseEvent {
  type: typeof TrustPingEventTypes.PingResponseReceived
  payload: {
    from: string
  }
}
