import type { MessagePickupRepository } from './MessagePickupRepository'
import type {
  AddMessageOptions,
  GetAvailableMessageCountOptions,
  RemoveMessagesOptions,
  TakeFromQueueOptions,
} from './MessagePickupRepositoryOptions'
import type { QueuedMessage } from './QueuedMessage'

import { InjectionSymbols } from '../../../constants'
import { Logger } from '../../../logger'
import { injectable, inject } from '../../../plugins'
import { uuid } from '../../../utils/uuid'

@injectable()
export class InMemoryMessagePickupRepository implements MessagePickupRepository {
  private logger: Logger
  private messages: { [key: string]: QueuedMessage[] } = {}

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
  }

  public getAvailableMessageCount(options: GetAvailableMessageCountOptions): number | Promise<number> {
    const { connectionId } = options
    return this.messages[connectionId] ? this.messages[connectionId].length : 0
  }

  public takeFromQueue(options: TakeFromQueueOptions) {
    const { connectionId, limit, keepMessages } = options

    if (!this.messages[connectionId]) {
      return []
    }

    const messagesToTake = limit ?? this.messages[connectionId].length
    this.logger.debug(`Taking ${messagesToTake} messages from queue for connection ${connectionId}`)

    return keepMessages
      ? this.messages[connectionId].slice(0, messagesToTake)
      : this.messages[connectionId].splice(0, messagesToTake)
  }

  public addMessage(options: AddMessageOptions) {
    const { connectionId, payload } = options
    if (!this.messages[connectionId]) {
      this.messages[connectionId] = []
    }

    const id = uuid()
    this.messages[connectionId].push({ id, encryptedMessage: payload })
    return id
  }

  public removeMessages(options: RemoveMessagesOptions): void | Promise<void> {
    const { connectionId, messageIds } = options

    if (!this.messages[connectionId]) return

    for (const messageId of messageIds) {
      const messageIndex = this.messages[connectionId].findIndex((item) => item.id === messageId)
      if (messageIndex > -1) this.messages[connectionId].splice(messageIndex, 1)
    }
  }
}
