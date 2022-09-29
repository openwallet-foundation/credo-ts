import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../../../types'
import type { BatchPickupMessage } from './messages'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { createOutboundMessage } from '../../../../../agent/helpers'
import { InjectionSymbols } from '../../../../../constants'
import { inject, injectable } from '../../../../../plugins'
import { MessageRepository } from '../../../../../storage/MessageRepository'

import { BatchHandler, BatchPickupHandler } from './handlers'
import { BatchMessage, BatchMessageMessage } from './messages'

@injectable()
export class MessagePickupService {
  private messageRepository: MessageRepository
  private dispatcher: Dispatcher
  private eventEmitter: EventEmitter

  public constructor(
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    dispatcher: Dispatcher,
    eventEmitter: EventEmitter
  ) {
    this.messageRepository = messageRepository
    this.dispatcher = dispatcher
    this.eventEmitter = eventEmitter

    this.registerHandlers()
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

    return createOutboundMessage(connection, batchMessage)
  }

  public async queueMessage(connectionId: string, message: EncryptedMessage) {
    await this.messageRepository.add(connectionId, message)
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new BatchPickupHandler(this))
    this.dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
  }
}
