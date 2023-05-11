import type {
  TrustPingMessage as V1TrustPingMessage,
  TrustPingResponseMessage as V1TrustPingResponseMessage,
} from './v1'
import type {
  TrustPingMessage as V2TrustPingMessage,
  TrustPingResponseMessage as V2TrustPingResponseMessage,
} from './v2'
import type { BaseEvent } from '../../../../agent/Events'
import type { ConnectionRecord } from '../../repository/ConnectionRecord'

export enum TrustPingEventTypes {
  TrustPingReceivedEvent = 'TrustPingReceivedEvent',
  TrustPingResponseReceivedEvent = 'TrustPingResponseReceivedEvent',
}

export interface TrustPingReceivedEvent extends BaseEvent {
  type: typeof TrustPingEventTypes.TrustPingReceivedEvent
  payload: {
    connectionRecord?: ConnectionRecord | null
    message: V1TrustPingMessage | V2TrustPingMessage
  }
}

export interface TrustPingResponseReceivedEvent extends BaseEvent {
  type: typeof TrustPingEventTypes.TrustPingResponseReceivedEvent
  payload: {
    connectionRecord?: ConnectionRecord | null
    message: V1TrustPingResponseMessage | V2TrustPingResponseMessage
  }
}
