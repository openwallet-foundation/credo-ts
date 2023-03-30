import type { AgentMessage } from '../../../agent/AgentMessage'
import type { ConnectionRecord } from '../../connections'

export interface PickupMessagesProtocolOptions {
  connectionRecord: ConnectionRecord
  recipientKey?: string
  batchSize?: number
}

export type PickupMessagesProtocolReturnType<MessageType extends AgentMessage> = {
  message: MessageType
}
