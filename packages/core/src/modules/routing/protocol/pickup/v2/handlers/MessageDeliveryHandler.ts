import type { Handler } from '../../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { MediationRecipientService } from '../../../../services'

import { createOutboundMessage } from '../../../../../../agent/helpers'
import { MessageDeliveryMessage } from '../messages/MessageDeliveryMessage'

export class MessageDeliveryHandler implements Handler {
  public supportedMessages = [MessageDeliveryMessage]
  private mediationRecipientService: MediationRecipientService

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: InboundMessageContext<MessageDeliveryMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryReceivedMessage = await this.mediationRecipientService.processDelivery(messageContext)

    if (deliveryReceivedMessage) {
      return createOutboundMessage(connection, deliveryReceivedMessage)
    }
  }
}
