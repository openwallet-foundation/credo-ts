import type { EncryptedMessage } from '../agent/didcomm'

export interface MessageRepository {
  takeFromQueue(connectionId: string, limit?: number): EncryptedMessage[]
  add(connectionId: string, payload: EncryptedMessage): void
}
