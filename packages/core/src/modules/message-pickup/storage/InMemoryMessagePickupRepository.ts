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

interface InMemoryQueuedMessage extends QueuedMessage {
  connectionId: string
  recipientKeys: string[]
}

@injectable()
export class InMemoryMessagePickupRepository implements MessagePickupRepository {
  private logger: Logger
  private messages: InMemoryQueuedMessage[]

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
    this.messages = []
  }

  public getAvailableMessageCount(options: GetAvailableMessageCountOptions): number | Promise<number> {
    const { connectionId, recipientKey } = options

    const messages = this.messages.filter(
      (msg) =>
        msg.connectionId === connectionId && (recipientKey === undefined || msg.recipientKeys.includes(recipientKey))
    )
    return messages.length
  }

  public takeFromQueue(options: TakeFromQueueOptions) {
    const { connectionId, recipientKey, limit, keepMessages } = options

    const messages = this.messages.filter(
      (msg) =>
        msg.connectionId === connectionId && (recipientKey === undefined || msg.recipientKeys.includes(recipientKey))
    )

    const messagesToTake = limit ?? messages.length
    this.logger.debug(`Taking ${messagesToTake} messages from queue for connection ${connectionId}`)

    if (!keepMessages) {
      this.removeMessages({ messageIds: messages.map((msg) => msg.id) })
    }

    return messages
  }

  public addMessage(options: AddMessageOptions) {
    const { connectionId, recipientKeys, payload } = options

    const id = uuid()
    this.messages.push({
      id,
      connectionId,
      encryptedMessage: payload,
      recipientKeys,
    })

    return id
  }

  public removeMessages(options: RemoveMessagesOptions) {
    const { messageIds } = options

    for (const messageId of messageIds) {
      const messageIndex = this.messages.findIndex((item) => item.id === messageId)
      if (messageIndex > -1) this.messages.splice(messageIndex, 1)
    }
  }
}
