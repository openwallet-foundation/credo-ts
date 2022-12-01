import type { EncryptedMessage } from '../../../../../agent/didcomm/types'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DeliveryRequestMessage } from './messages'
import type { AgentMessageReceivedEvent } from '@aries-framework/core'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../../../agent/Events'
import { MessageSender } from '../../../../../agent/MessageSender'
import { InjectionSymbols } from '../../../../../constants'
import { inject, injectable } from '../../../../../plugins'
import { MessageRepository } from '../../../../../storage/MessageRepository'
import { uuid } from '../../../../../utils/uuid'

import { DeliveryRequestHandler, DeliveryHandler } from './handlers'
import { DeliveryMessage, MessagesReceivedMessage } from './messages'

@injectable()
export class MessagePickupService {
  private messageRepository: MessageRepository
  private eventEmitter: EventEmitter
  private messageSender: MessageSender
  private dispatcher: Dispatcher

  public constructor(
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    dispatcher: Dispatcher,
    eventEmitter: EventEmitter,
    messageSender: MessageSender
  ) {
    this.messageRepository = messageRepository
    this.dispatcher = dispatcher
    this.eventEmitter = eventEmitter
    this.messageSender = messageSender

    this.registerHandlers()
  }

  public async handleDeliveryRequest(messageContext: InboundMessageContext<DeliveryRequestMessage>) {
    const { message } = messageContext

    if (!message.from) return

    const messages = await this.messageRepository.takeFromQueue(message.from, message.body.limit)

    return new DeliveryMessage({
      body: {},
      attachments: messages.map((message) => DeliveryMessage.createJSONAttachment(uuid(), message)),
    })
  }

  public async handleDelivery(messageContext: InboundMessageContext<DeliveryMessage>) {
    const { message } = messageContext
    if (!message.from || !message.to) return

    if (!message.attachments.length) return

    const forwardedMessages = message.attachments

    forwardedMessages.forEach((message) => {
      this.eventEmitter.emit<AgentMessageReceivedEvent>({
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: DeliveryMessage.unpackAttachmentAsJson(message),
        },
      })
    })

    const messageIdList = message.attachments.flatMap((a) => (a.id ? [a.id] : []))
    return new MessagesReceivedMessage({
      from: message.to[0],
      to: message.from,
      body: { messageIdList },
    })
  }

  public queueMessage(connectionId: string, message: EncryptedMessage) {
    void this.messageRepository.add(connectionId, message)
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new DeliveryRequestHandler(this, this.messageSender))
    this.dispatcher.registerHandler(new DeliveryHandler(this, this.messageSender))
  }
}
