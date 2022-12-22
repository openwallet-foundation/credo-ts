import type { BaseEvent } from '../../agent/Events'
import type { DidExchangeState } from './models'
import type { ConnectionRecord } from './repository/ConnectionRecord'

export enum TrustPingEventTypes {
  TrustPingRequestEvent = 'TrustPingRequestEvent',
  TrustPingResponseEvent = 'TrustPingResponseEvent',
}

export interface TrustPingRequestEvent extends BaseEvent {
  type: typeof TrustPingEventTypes.TrustPingRequestEvent
  payload: {
    connectionRecord: ConnectionRecord
  }
}

export interface TrustPingResponseEvent extends BaseEvent {
    type: typeof TrustPingEventTypes.TrustPingResponseEvent
    payload: {
      connectionRecord: ConnectionRecord
    }
  }
