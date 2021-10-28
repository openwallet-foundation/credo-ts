import type { BaseEvent } from '../../agent/Events'
import type { BasicMessage } from './messages'
import type { BasicMessageRecord } from './repository'

export declare enum BasicMessageEventTypes {
  BasicMessageReceived = 'BasicMessageReceived',
  BasicMessageSent = 'BasicMessageSent',
}
export interface BasicMessageReceivedEvent extends BaseEvent {
  type: typeof BasicMessageEventTypes.BasicMessageReceived
  payload: {
    message: BasicMessage
    basicMessageRecord: BasicMessageRecord
  }
}
export interface BasicMessageSentEvent extends BaseEvent {
  type: typeof BasicMessageEventTypes.BasicMessageSent
  payload: {
    message: BasicMessage
    basicMessageRecord: BasicMessageRecord
  }
}
