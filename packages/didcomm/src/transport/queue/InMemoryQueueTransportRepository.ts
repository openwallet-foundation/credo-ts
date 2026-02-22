import { AgentContext, injectable, utils } from '@credo-ts/core'
import type { DidCommQueueTransportRepository } from './DidCommQueueTransportRepository'
import type { QueuedDidCommMessage } from './QueuedDidCommMessage'
import type {
  AddMessageOptions,
  GetAvailableMessageCountOptions,
  RemoveMessagesOptions,
  TakeFromQueueOptions,
} from './QueueTransportRepositoryOptions'

interface InMemoryQueuedDidCommMessage extends QueuedDidCommMessage {
  connectionId: string
  recipientDids: string[]
  state: 'pending' | 'sending'
}

@injectable()
export class InMemoryDidCommQueueTransportRepository implements DidCommQueueTransportRepository {
  private messages: InMemoryQueuedDidCommMessage[]

  public constructor() {
    this.messages = []
  }

  public getAvailableMessageCount(
    _agentContext: AgentContext,
    options: GetAvailableMessageCountOptions
  ): number | Promise<number> {
    const { connectionId, recipientDid } = options

    const messages = this.messages.filter(
      (msg) =>
        msg.connectionId === connectionId &&
        (recipientDid === undefined || msg.recipientDids.includes(recipientDid)) &&
        msg.state === 'pending'
    )
    return messages.length
  }

  public takeFromQueue(agentContext: AgentContext, options: TakeFromQueueOptions): QueuedDidCommMessage[] {
    const { connectionId, recipientDid, limit, deleteMessages } = options

    let messages = this.messages.filter(
      (msg) =>
        msg.connectionId === connectionId &&
        msg.state === 'pending' &&
        (recipientDid === undefined || msg.recipientDids.includes(recipientDid))
    )

    const messagesToTake = limit ?? messages.length

    messages = messages.slice(0, messagesToTake)

    agentContext.config.logger.debug(`Taking ${messagesToTake} messages from queue for connection ${connectionId}`)

    // Mark taken messages in order to prevent them of being retrieved again
    for (const msg of messages) {
      const index = this.messages.findIndex((item) => item.id === msg.id)
      if (index !== -1) this.messages[index].state = 'sending'
    }

    if (deleteMessages) {
      this.removeMessages(agentContext, { connectionId, messageIds: messages.map((msg) => msg.id) })
    }

    return messages
  }

  public addMessage(_agentContext: AgentContext, options: AddMessageOptions) {
    const { connectionId, recipientDids, payload } = options

    const id = utils.uuid()
    this.messages.push({
      id,
      receivedAt: options.receivedAt ?? new Date(),
      connectionId,
      encryptedMessage: payload,
      recipientDids,
      state: 'pending',
    })

    return id
  }

  public removeMessages(_agentContext: AgentContext, options: RemoveMessagesOptions) {
    const { messageIds } = options

    for (const messageId of messageIds) {
      const messageIndex = this.messages.findIndex((item) => item.id === messageId)
      if (messageIndex > -1) this.messages.splice(messageIndex, 1)
    }
  }
}
