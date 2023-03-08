import type { BatchPickupMessage } from './messages'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../../../types'

import { EventEmitter } from '../../../../../agent/EventEmitter'
import { MessageHandlerRegistry } from '../../../../../agent/MessageHandlerRegistry'
import { OutboundMessageContext } from '../../../../../agent/models'
import { InjectionSymbols } from '../../../../../constants'
import { inject, injectable } from '../../../../../plugins'
import { MessageRepository } from '../../../../../storage/MessageRepository'

import { BatchHandler, BatchPickupHandler } from './handlers'
import { BatchMessage, BatchMessageMessage } from './messages'

@injectable()
export class MessagePickupService {
  private messageRepository: MessageRepository
  private eventEmitter: EventEmitter

  public constructor(
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    messageHandlerRegistry: MessageHandlerRegistry,
    eventEmitter: EventEmitter
  ) {
    this.messageRepository = messageRepository
    this.eventEmitter = eventEmitter

    this.registerMessageHandlers(messageHandlerRegistry)
  }

  public async batch(messageContext: InboundMessageContext<BatchPickupMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const { message } = messageContext
    const messages = await this.messageRepository.takeFromQueue(connection.id, message.batchSize)

    // TODO: each message should be stored with an id. to be able to conform to the id property
    // of batch message
    const batchMessages = messages.map(
      (msg) =>
        new BatchMessageMessage({
          message: msg,
        })
    )

    const batchMessage = new BatchMessage({
      messages: batchMessages,
    })

    return new OutboundMessageContext(batchMessage, { agentContext: messageContext.agentContext, connection })
  }

  public async queueMessage(connectionId: string, message: EncryptedMessage) {
    await this.messageRepository.add(connectionId, message)
  }

  protected registerMessageHandlers(messageHandlerRegistry: MessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new BatchPickupHandler(this))
    messageHandlerRegistry.registerMessageHandler(new BatchHandler(this.eventEmitter))
  }
}
