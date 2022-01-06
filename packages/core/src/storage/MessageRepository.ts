import type { EncryptedMessage } from '../types'

export interface MessageRepository {
  takeFromQueue(connectionId: string, limit?: number): EncryptedMessage[]
  add(connectionId: string, payload: EncryptedMessage): void
}
