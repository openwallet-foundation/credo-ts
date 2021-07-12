import type { WireMessage } from '../types'
import type { MessageRepository } from './MessageRepository'

import { Lifecycle, scoped } from 'tsyringe'

@scoped(Lifecycle.ContainerScoped)
export class InMemoryMessageRepository implements MessageRepository {
  private messages: { [key: string]: WireMessage[] } = {}

  public takeFromQueue(connectionId: string, limit?: number) {
    if (!this.messages[connectionId]) {
      return []
    }

    const messagesToTake = limit ?? this.messages[connectionId].length

    return this.messages[connectionId].splice(0, messagesToTake)
  }

  public add(connectionId: string, payload: WireMessage) {
    if (!this.messages[connectionId]) {
      this.messages[connectionId] = []
    }

    this.messages[connectionId].push(payload)
  }
}
