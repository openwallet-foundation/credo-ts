import type { EncryptedMessage } from '../types'

export interface MessageRepository {
  getAvailableMessageCount(connectionId: string): number | Promise<number>
  takeFromQueue(
    connectionId: string,
    limit?: number,
    keepMessages?: boolean
  ): EncryptedMessage[] | Promise<EncryptedMessage[]>
  add(connectionId: string, payload: EncryptedMessage): void | Promise<void>
}
