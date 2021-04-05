import type { Verkey } from 'indy-sdk'
import { MessageRepository } from './MessageRepository'
import { WireMessage } from '../types'

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
