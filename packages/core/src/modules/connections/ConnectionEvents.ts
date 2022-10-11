import type { BaseEvent } from '../../agent/Events'
import type { TellDidMessage, TellDidResponseMessage } from './messages'
import type { DidExchangeState } from './models'
import type { ConnectionRecord } from './repository/ConnectionRecord'

export enum ConnectionEventTypes {
  ConnectionStateChanged = 'ConnectionStateChanged',
}

export enum TrustPingEventTypes {
  TrustPingResponseReceived = 'TrustPingResponseReceived',
}

export enum TellDidEventTypes {
  TellDidMessageReceived = 'TellDidResponseReceived',
  TellDidResponseReceived = 'TellDidResponseReceived',
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

export interface TellDidMessageReceivedEvent extends BaseEvent {
  type: typeof TellDidEventTypes.TellDidMessageReceived
  payload: {
    message: TellDidMessage
  }
}

export interface TellDidResponseReceivedEvent extends BaseEvent {
  type: typeof TellDidEventTypes.TellDidResponseReceived
  payload: {
    message: TellDidResponseMessage
  }
}
