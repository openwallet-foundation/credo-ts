import type { AgentMessage } from '../../../agent/AgentMessage'
import type { ConnectionRecord } from '../../connections'
import type { QueuedMessage } from '../storage'

export interface PickupMessagesProtocolOptions {
  connectionRecord: ConnectionRecord
  recipientKey?: string
  batchSize?: number
}

export interface DeliverMessagesProtocolOptions {
  connectionRecord: ConnectionRecord
  messages?: QueuedMessage[]
  recipientKey?: string
  batchSize?: number
}

export interface SetLiveDeliveryModeProtocolOptions {
  connectionRecord: ConnectionRecord
  liveDelivery: boolean
}

export type PickupMessagesProtocolReturnType<MessageType extends AgentMessage> = {
  message: MessageType
}

export type DeliverMessagesProtocolReturnType<MessageType extends AgentMessage> = {
  message: MessageType
}

export type SetLiveDeliveryModeProtocolReturnType<MessageType extends AgentMessage> = {
  message: MessageType
}
