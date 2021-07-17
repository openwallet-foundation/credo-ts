import type { WireMessage } from '../types'

export interface MessageRepository {
  takeFromQueue(connectionId: string, limit?: number): WireMessage[]
  add(connectionId: string, payload: WireMessage): void
}
