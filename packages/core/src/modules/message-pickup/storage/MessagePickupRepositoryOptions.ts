import type { EncryptedMessage } from '../../../types'

export interface GetAvailableMessageCountOptions {
  connectionId: string
  recipientKey?: string
}

export interface TakeFromQueueOptions {
  connectionId: string
  recipientKey?: string
  limit?: number
  keepMessages?: boolean
}

export interface AddMessageOptions {
  connectionId: string
  recipientKeys: string[]
  payload: EncryptedMessage
}

export interface RemoveMessagesOptions {
  connectionId: string
  messageIds: string[]
}
