import type { EncryptedMessage } from '../types'
import type { MessageRepository } from './MessageRepository'

import { InjectionSymbols } from '../constants'
import { Logger } from '../logger'
import { injectable, inject } from '../plugins'

@injectable()
export class InMemoryMessageRepository implements MessageRepository {
  private logger: Logger
  private messages: { [key: string]: EncryptedMessage[] } = {}

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
  }

  public takeFromQueue(connectionId: string, limit?: number) {
    if (!this.messages[connectionId]) {
      return []
    }

    const messagesToTake = limit ?? this.messages[connectionId].length
    this.logger.debug(`Taking ${messagesToTake} messages from queue for connection ${connectionId}`)

    return this.messages[connectionId].splice(0, messagesToTake)
  }

  public add(connectionId: string, payload: EncryptedMessage) {
    if (!this.messages[connectionId]) {
      this.messages[connectionId] = []
    }

    this.messages[connectionId].push(payload)
  }
}
