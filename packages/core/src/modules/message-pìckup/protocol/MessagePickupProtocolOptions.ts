import type { DidCommV1Message } from '../../../didcomm'
import type { ConnectionRecord } from '../../connections'

export interface PickupMessagesProtocolOptions {
  connectionRecord: ConnectionRecord
  recipientKey?: string
  batchSize?: number
}

export type PickupMessagesProtocolReturnType<MessageType extends DidCommV1Message> = {
  message: MessageType
}
