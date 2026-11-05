import type { DidCommEncryptedMessage } from '../../types'

export interface GetAvailableMessageCountOptions {
  connectionId: string
  recipientDid?: string
}

export interface TakeFromQueueOptions {
  connectionId: string
  recipientDid?: string
  /**
   * Only take the messages with these ids. Implementations must honor this, as live mode delivery relies on it to deliver only the arriving message.
   */
  messageIds?: string[]
  limit?: number
  deleteMessages?: boolean
}

export interface AddMessageOptions {
  connectionId: string
  recipientDids: string[]
  payload: DidCommEncryptedMessage
  receivedAt?: Date
}

export interface RemoveMessagesOptions {
  connectionId: string
  messageIds: string[]
}
