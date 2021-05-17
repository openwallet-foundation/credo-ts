import type { Verkey } from 'indy-sdk'
import { BaseEvent } from '../../agent/Events'
import { BasicMessage } from './messages'

export enum BasicMessageEventTypes {
  BasicMessageReceived = 'BasicMessageReceived',
}

export interface BasicMessageReceivedEvent extends BaseEvent {
  type: typeof BasicMessageEventTypes.BasicMessageReceived
  payload: {
    message: BasicMessage
    verkey: Verkey
  }
}
