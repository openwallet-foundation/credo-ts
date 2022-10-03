import type { EncryptedMessage } from '../agent/didcomm'

export interface MessageRepository {
  getAvailableMessageCount(connectionId: string): number | Promise<number>
  takeFromQueue(
    connectionId: string,
    limit?: number,
    keepMessages?: boolean
  ): EncryptedMessage[] | Promise<EncryptedMessage[]>
  add(connectionId: string, payload: EncryptedMessage): void | Promise<void>
}
