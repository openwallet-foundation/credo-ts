import type { AgentBaseMessage } from '../../../agent/AgentBaseMessage'
import type { ConnectionRecord } from '../../connections'
import type { BasicMessageRecord } from '../repository'

export interface CreateMessageOptions {
  connectionRecord: ConnectionRecord
  content: string
  parentThreadId?: string
}

export interface BasicMessageProtocolMsgReturnType<MessageType extends AgentBaseMessage> {
  message: MessageType
  record: BasicMessageRecord
}
