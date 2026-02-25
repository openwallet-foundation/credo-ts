import type { BaseEvent } from '@credo-ts/core'
import type { DidCommTrustPingMessage, DidCommTrustPingResponseMessage } from './messages'
import type { DidCommConnectionRecord } from './repository'

export enum DidCommTrustPingEventTypes {
  DidCommTrustPingReceivedEvent = 'DidCommTrustPingReceivedEvent',
  DidCommTrustPingResponseReceivedEvent = 'DidCommTrustPingResponseReceivedEvent',
}

export interface DidCommTrustPingReceivedEvent extends BaseEvent {
  type: typeof DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent
  payload: {
    connectionRecord: DidCommConnectionRecord
    message: DidCommTrustPingMessage
  }
}

export interface TrustPingResponseReceivedEvent extends BaseEvent {
  type: typeof DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent
  payload: {
    connectionRecord: DidCommConnectionRecord
    message: DidCommTrustPingResponseMessage
  }
}
