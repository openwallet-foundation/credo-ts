import { EncryptedMessage } from '../../types'

export interface GetAvailableMessageCountOptions {
  connectionId: string
  recipientDid?: string
}

export interface TakeFromQueueOptions {
  connectionId: string
  recipientDid?: string
  limit?: number
  deleteMessages?: boolean
}

export interface AddMessageOptions {
  connectionId: string
  recipientDids: string[]
  payload: EncryptedMessage
  receivedAt?: Date
}

export interface RemoveMessagesOptions {
  connectionId: string
  messageIds: string[]
}
