import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../../types'
import type { ConnectionRecord } from '../../../connections'

import { EventEmitter } from '../../../../agent/EventEmitter'
import { FeatureRegistry } from '../../../../agent/FeatureRegistry'
import { MessageHandlerRegistry } from '../../../../agent/MessageHandlerRegistry'
import { OutboundMessageContext, Protocol } from '../../../../agent/models'
import { InjectionSymbols } from '../../../../constants'
import { inject, injectable } from '../../../../plugins'
import { MessageRepository } from '../../../../storage/MessageRepository'

import { V1BatchHandler, V1BatchPickupHandler } from './handlers'
import { V1BatchMessage, BatchMessageMessage, V1BatchPickupMessage } from './messages'

@injectable()
export class V1MessagePickupProtocol {
  private messageRepository: MessageRepository
  private eventEmitter: EventEmitter

  public constructor(
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    messageHandlerRegistry: MessageHandlerRegistry,
    eventEmitter: EventEmitter,
    featureRegistry: FeatureRegistry
  ) {
    this.messageRepository = messageRepository
    this.eventEmitter = eventEmitter

    this.registerMessageHandlers(messageHandlerRegistry)

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/messagepickup/1.0',
        roles: ['message_holder', 'recipient', 'batch_sender', 'batch_recipient'],
      })
    )
  }

  public async createBatchPickupMessage(
    connectionRecord: ConnectionRecord,
    config: {
      batchSize: number
    }
  ) {
    connectionRecord.assertReady()

    const batchMessage = new V1BatchPickupMessage({
      batchSize: config.batchSize,
    })

    return batchMessage
  }
  public async batch(messageContext: InboundMessageContext<V1BatchPickupMessage>) {
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

    const batchMessage = new V1BatchMessage({
      messages: batchMessages,
    })

    return new OutboundMessageContext(batchMessage, { agentContext: messageContext.agentContext, connection })
  }

  public async queueMessage(connectionId: string, message: EncryptedMessage) {
    await this.messageRepository.add(connectionId, message)
  }

  protected registerMessageHandlers(messageHandlerRegistry: MessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new V1BatchPickupHandler(this))
    messageHandlerRegistry.registerMessageHandler(new V1BatchHandler(this.eventEmitter))
  }
}
