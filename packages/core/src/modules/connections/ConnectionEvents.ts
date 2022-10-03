import type { BaseEvent } from '../../agent/Events'
import type { DidExchangeState } from './models'
import type { ConnectionRecord } from './repository/ConnectionRecord'

export enum ConnectionEventTypes {
  ConnectionStateChanged = 'ConnectionStateChanged',
}

export enum TrustPingEventTypes {
  TrustPingResponseReceived = 'TrustPingResponseReceived',
}

export interface ConnectionStateChangedEvent extends BaseEvent {
  type: typeof ConnectionEventTypes.ConnectionStateChanged
  payload: {
    connectionRecord: ConnectionRecord
    previousState: DidExchangeState | null
  }
}

export interface TrustPingReceivedEvent extends BaseEvent {
  type: typeof TrustPingEventTypes.TrustPingResponseReceived
  payload: {
    thid: string
  }
}
