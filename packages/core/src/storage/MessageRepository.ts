import type { EncryptedMessage } from '../types'

export interface MessageRepository {
  takeFromQueue(connectionId: string, limit?: number): EncryptedMessage[] | Promise<EncryptedMessage[]>
  add(connectionId: string, payload: EncryptedMessage): void | Promise<void>
}
