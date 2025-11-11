import type { DidCommMessage } from '../../../DidCommMessage'
import type { QueuedDidCommMessage } from '../../../transport/queue'
import type { DidCommConnectionRecord } from '../../connections/repository'

export interface PickupMessagesProtocolOptions {
  connectionRecord: DidCommConnectionRecord
  recipientDid?: string
  batchSize?: number
}

export interface DeliverMessagesProtocolOptions {
  connectionRecord: DidCommConnectionRecord
  messages?: QueuedDidCommMessage[]
  recipientKey?: string
  batchSize?: number
}

export interface SetLiveDeliveryModeProtocolOptions {
  connectionRecord: DidCommConnectionRecord
  liveDelivery: boolean
}

export type PickupMessagesProtocolReturnType<MessageType extends DidCommMessage> = {
  message: MessageType
}

export type DeliverMessagesProtocolReturnType<MessageType extends DidCommMessage> = {
  message: MessageType
}

export type SetLiveDeliveryModeProtocolReturnType<MessageType extends DidCommMessage> = {
  message: MessageType
}
