import type { Handler } from '../../../agent/Handler'
import type { MessageReceiver } from '../../../agent/MessageReceiver'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { MediatorService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { MessageDeliveryMessage } from '../messages'

export class MessageDeliveryHandler implements Handler {
  public supportedMessages = [MessageDeliveryMessage]
  private mediatorService: MediatorService
  private messageReceiver: MessageReceiver

  public constructor(mediatorService: MediatorService, messageReceiver: MessageReceiver) {
    this.mediatorService = mediatorService
    this.messageReceiver = messageReceiver
  }

  public async handle(messageContext: InboundMessageContext<MessageDeliveryMessage>) {
    const deliveryReceivedMessage = await this.mediatorService.processDelivery(
      messageContext.message,
      this.messageReceiver
    )
    const connection = messageContext.connection

    if (connection && deliveryReceivedMessage) {
      return createOutboundMessage(connection, deliveryReceivedMessage)
    }
  }
}
