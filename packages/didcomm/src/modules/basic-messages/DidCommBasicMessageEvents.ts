import type { BaseEvent } from '@credo-ts/core'
import type { DidCommBasicMessage, DidCommBasicMessageV2 } from './messages'
import type { DidCommBasicMessageRecord } from './repository'

export enum DidCommBasicMessageEventTypes {
  DidCommBasicMessageStateChanged = 'DidCommBasicMessageStateChanged',
  DidCommBasicMessageV2StateChanged = 'DidCommBasicMessageV2StateChanged',
}

export interface DidCommBasicMessageStateChangedEvent extends BaseEvent {
  type: typeof DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged
  payload: {
    message: DidCommBasicMessage
    basicMessageRecord: DidCommBasicMessageRecord
  }
}

export interface DidCommBasicMessageV2StateChangedEvent extends BaseEvent {
  type: typeof DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged
  payload: {
    message: DidCommBasicMessageV2
    basicMessageRecord: DidCommBasicMessageRecord
  }
}
