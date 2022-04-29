import type { EncryptedMessage } from '@aries-framework/core'

export interface MessageRepository {
  takeFromQueue(connectionId: string, limit?: number): EncryptedMessage[]
  add(connectionId: string, payload: EncryptedMessage): void
}
