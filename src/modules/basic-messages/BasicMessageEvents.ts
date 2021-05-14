import type { Verkey } from 'indy-sdk'
import { BasicMessage } from './messages'

export interface BasicMessageReceivedEvent {
  type: 'BasicMessageReceived'
  message: BasicMessage
  verkey: Verkey
}
