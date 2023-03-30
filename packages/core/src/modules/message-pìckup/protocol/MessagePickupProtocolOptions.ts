import type { AgentMessage } from '../../../agent/AgentMessage'
import type { EncryptedMessage } from '../../../types'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'

export interface QueueMessageOptions {
  connectionRecord: ConnectionRecord
  message: EncryptedMessage
}

export interface PickupMessagesOptions {
  connectionRecord: ConnectionRecord
  recipientKey?: string
  batchSize?: number
}

export type QueueMessageReturnType = void

export type PickupMessagesReturnType<MessageType extends AgentMessage> = {
  message: MessageType
}
