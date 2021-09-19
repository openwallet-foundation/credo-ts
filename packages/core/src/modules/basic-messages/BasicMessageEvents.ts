import type { BaseEvent } from '../../agent/Events'
import type { BasicMessage } from './messages'
import type { BasicMessageRecord } from './repository'

export enum BasicMessageEventTypes {
  BasicMessageReceived = 'BasicMessageReceived',
}

export interface BasicMessageReceivedEvent extends BaseEvent {
  type: typeof BasicMessageEventTypes.BasicMessageReceived
  payload: {
    message: BasicMessage
    basicMessageRecord: BasicMessageRecord
  }
}
