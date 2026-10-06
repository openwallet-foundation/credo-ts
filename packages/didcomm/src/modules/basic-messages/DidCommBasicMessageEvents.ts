import type { BaseEvent } from '@credo-ts/core'
import type { DidCommBasicMessage } from './protocol/v1'
import type { DidCommBasicMessageV2 } from './protocol/v2'
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
