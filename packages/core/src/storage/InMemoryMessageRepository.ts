import type { WireMessage } from '../types'
import type { MessageRepository } from './MessageRepository'
import type { Verkey } from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

@scoped(Lifecycle.ContainerScoped)
export class InMemoryMessageRepository implements MessageRepository {
  private messages: { [key: string]: WireMessage } = {}

  public findByVerkey(theirKey: Verkey): WireMessage[] {
    return this.messages[theirKey] ?? []
  }

  public deleteAllByVerkey(theirKey: Verkey): void {
    this.messages[theirKey] = []
  }

  public save(theirKey: Verkey, payload: WireMessage) {
    if (!this.messages[theirKey]) {
      this.messages[theirKey] = []
    }
    this.messages[theirKey].push(payload)
  }
}
