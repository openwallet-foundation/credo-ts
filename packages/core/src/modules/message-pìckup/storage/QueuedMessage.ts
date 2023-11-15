import type { EncryptedMessage } from '../../../types'

export type QueuedMessage = {
  id: string
  encryptedMessage: EncryptedMessage
  state?: string
}
