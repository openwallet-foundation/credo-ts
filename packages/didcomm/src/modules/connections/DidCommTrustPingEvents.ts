import type { BaseEvent } from '@credo-ts/core'
import type {
  DidCommTrustPingMessage,
  DidCommTrustPingResponseMessage,
  DidCommTrustPingResponseV2Message,
  DidCommTrustPingV2Message,
} from './messages'
import type { DidCommConnectionRecord } from './repository'

export enum DidCommTrustPingEventTypes {
  DidCommTrustPingReceivedEvent = 'DidCommTrustPingReceivedEvent',
  DidCommTrustPingResponseReceivedEvent = 'DidCommTrustPingResponseReceivedEvent',
}

export interface DidCommTrustPingReceivedEvent extends BaseEvent {
  type: typeof DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent
  payload: {
    connectionRecord: DidCommConnectionRecord
    message: DidCommTrustPingMessage | DidCommTrustPingV2Message
  }
}

export interface TrustPingResponseReceivedEvent extends BaseEvent {
  type: typeof DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent
  payload: {
    connectionRecord: DidCommConnectionRecord
    message: DidCommTrustPingResponseMessage | DidCommTrustPingResponseV2Message
  }
}
