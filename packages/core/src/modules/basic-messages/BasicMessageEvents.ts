import type { V1BasicMessage, V2BasicMessage } from './protocols'
import type { BasicMessageRecord } from './repository'
import type { BaseEvent } from '../../agent/Events'

export enum BasicMessageEventTypes {
  BasicMessageStateChanged = 'BasicMessageStateChanged',
}
export interface BasicMessageStateChangedEvent extends BaseEvent {
  type: typeof BasicMessageEventTypes.BasicMessageStateChanged
  payload: {
    message: V1BasicMessage | V2BasicMessage
    basicMessageRecord: BasicMessageRecord
  }
}
