import type { DidCommMessage } from '../../../DidCommMessage'
import type { QueuedDidCommMessage } from '../../../transport/queue'
import type { ConnectionRecord } from '../../connections/repository'

export interface PickupMessagesProtocolOptions {
  connectionRecord: ConnectionRecord
  recipientDid?: string
  batchSize?: number
}

export interface DeliverMessagesProtocolOptions {
  connectionRecord: ConnectionRecord
  messages?: QueuedDidCommMessage[]
  recipientKey?: string
  batchSize?: number
}

export interface SetLiveDeliveryModeProtocolOptions {
  connectionRecord: ConnectionRecord
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
