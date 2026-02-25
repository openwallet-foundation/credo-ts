import type { BaseEvent } from '@credo-ts/core'
import type { DidCommBasicMessage } from './messages'
import type { DidCommBasicMessageRecord } from './repository'

export enum DidCommBasicMessageEventTypes {
  DidCommBasicMessageStateChanged = 'DidCommBasicMessageStateChanged',
}
export interface DidCommBasicMessageStateChangedEvent extends BaseEvent {
  type: typeof DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged
  payload: {
    message: DidCommBasicMessage
    basicMessageRecord: DidCommBasicMessageRecord
  }
}
