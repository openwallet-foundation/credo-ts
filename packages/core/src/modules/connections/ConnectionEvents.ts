import type { BaseEvent } from '../../agent/Events'
import type { DidExchangeState, TellDidState } from './models'
import type { ConnectionRecord } from './repository/ConnectionRecord'

export enum ConnectionEventTypes {
  ConnectionStateChanged = 'ConnectionStateChanged',
}

export enum TrustPingEventTypes {
  TrustPingResponseReceived = 'TrustPingResponseReceived',
}

export enum TellDidEventTypes {
  TellDidStateChanged = 'TellDidStateChanged',
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

export interface TellDidStateChangedEvent extends BaseEvent {
  type: typeof TellDidEventTypes.TellDidStateChanged
  payload: {
    remoteDid: string
    state: TellDidState
    thid: string
    label?: string
  }
}
