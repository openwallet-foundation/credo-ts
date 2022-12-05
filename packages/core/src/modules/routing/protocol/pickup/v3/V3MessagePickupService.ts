import type { AgentMessageReceivedEvent } from '../../../../../agent/Events'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../../../didcomm/types'
import type { DeliveryRequestMessage, StatusRequestMessage } from './messages'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../../../agent/Events'
import { MessageSender } from '../../../../../agent/MessageSender'
import { InjectionSymbols } from '../../../../../constants'
import { createJSONAttachment } from '../../../../../decorators/attachment/v2/Attachment'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { inject, injectable } from '../../../../../plugins'
import { MessageRepository } from '../../../../../storage/MessageRepository'
import { uuid } from '../../../../../utils/uuid'

import {
  DeliveryHandler,
  DeliveryRequestHandler,
  MessagesReceivedHandler,
  StatusRequestHandler,
  StatusResponseHandler,
} from './handlers'
import { DeliveryMessage, MessagesReceivedMessage, StatusResponseMessage } from './messages'

@injectable()
export class V3MessagePickupService {
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

  public async processStatusRequest(messageContext: InboundMessageContext<StatusRequestMessage>) {
    const { message } = messageContext

    if (!message.from) {
      throw new AriesFrameworkError('Message des not contain sender!')
    }

    const recipient = message.firstRecipient
    if (!recipient) {
      throw new AriesFrameworkError('Message des not contain recipient!')
    }

    return new StatusResponseMessage({
      thid: messageContext.message.id,
      body: {
        messageCount: await this.messageRepository.getAvailableMessageCount(recipient),
      },
    })
  }

  public async processStatusResponse(messageContext: InboundMessageContext<StatusResponseMessage>) {
    const { message } = messageContext

    if (!message.from) {
      throw new AriesFrameworkError('Message des not contain sender!')
    }

    const recipient = message.firstRecipient
    if (!recipient) {
      throw new AriesFrameworkError('Message des not contain recipient!')
    }

    return
  }

  public async handleDeliveryRequest(messageContext: InboundMessageContext<DeliveryRequestMessage>) {
    const { message } = messageContext

    if (!message.from) {
      throw new AriesFrameworkError('Message des not contain sender!')
    }

    const recipient = message.firstRecipient
    if (!recipient) {
      throw new AriesFrameworkError('Message des not contain recipient!')
    }

    const messages = await this.messageRepository.takeFromQueue(message.from, message.body.limit, true)

    return new DeliveryMessage({
      body: {},
      attachments: messages.map((message) => createJSONAttachment(uuid(), message)),
    })
  }

  public async handleDelivery(messageContext: InboundMessageContext<DeliveryMessage>) {
    const { message } = messageContext

    if (!message.from) {
      throw new AriesFrameworkError('Message des not contain sender!')
    }

    const recipient = message.firstRecipient
    if (!recipient) {
      throw new AriesFrameworkError('Message des not contain recipient!')
    }

    if (!message.attachments.length) return

    const forwardedMessages = message.attachments

    forwardedMessages.forEach((message) => {
      this.eventEmitter.emit<AgentMessageReceivedEvent>(messageContext.agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          contextCorrelationId: messageContext.agentContext.contextCorrelationId,
          message: message.getDataAsJson(),
        },
      })
    })

    // @ts-ignore
    const messageIdList: string[] = message.attachments.map((attachment) => attachment.id).filter((id) => id)

    return new MessagesReceivedMessage({
      from: message.firstRecipient,
      to: message.from,
      body: { messageIdList },
    })
  }

  public async processMessagesReceived(messageContext: InboundMessageContext<MessagesReceivedMessage>) {
    const { message } = messageContext

    if (!message.from) {
      throw new AriesFrameworkError('Message des not contain sender!')
    }

    const recipient = message.firstRecipient
    if (!recipient) {
      throw new AriesFrameworkError('Message des not contain recipient!')
    }

    await this.messageRepository.takeFromQueue(recipient, message.body.messageIdList.length)

    return undefined
  }

  public queueMessage(id: string, message: EncryptedMessage) {
    void this.messageRepository.add(id, message)
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new DeliveryRequestHandler(this, this.messageSender))
    this.dispatcher.registerHandler(new DeliveryHandler(this, this.messageSender))
    this.dispatcher.registerHandler(new MessagesReceivedHandler(this))
    this.dispatcher.registerHandler(new StatusRequestHandler(this, this.messageSender))
    this.dispatcher.registerHandler(new StatusResponseHandler(this))
  }
}
