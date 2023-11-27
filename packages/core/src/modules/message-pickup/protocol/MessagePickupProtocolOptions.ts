import type { AgentMessage } from '../../../agent/AgentMessage'
import type { ConnectionRecord } from '../../connections'

export interface PickupMessagesProtocolOptions {
  connectionRecord: ConnectionRecord
  recipientKey?: string
  batchSize?: number
}

export interface DeliverMessagesProtocolOptions {
  connectionRecord: ConnectionRecord
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
