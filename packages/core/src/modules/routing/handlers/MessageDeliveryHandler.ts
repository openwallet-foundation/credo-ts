import type { Handler } from '../../../agent/Handler'
import type { MessageReceiver } from '../../../agent/MessageReceiver'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { MediationRecipientService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { MessageDeliveryMessage } from '../messages'

export class MessageDeliveryHandler implements Handler {
  public supportedMessages = [MessageDeliveryMessage]
  private mediationRecipientService: MediationRecipientService
  private messageReceiver: MessageReceiver

  public constructor(mediationRecipientService: MediationRecipientService, messageReceiver: MessageReceiver) {
    this.mediationRecipientService = mediationRecipientService
    this.messageReceiver = messageReceiver
  }

  public async handle(messageContext: InboundMessageContext<MessageDeliveryMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryReceivedMessage = await this.mediationRecipientService.processDelivery(
      messageContext.message,
      this.messageReceiver
    )

    if (deliveryReceivedMessage) {
      return createOutboundMessage(connection, deliveryReceivedMessage)
    }
  }
}
