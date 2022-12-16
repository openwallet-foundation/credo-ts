import type { MessageHandler } from '../../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { MediationRecipientService } from '../../../../services'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { MessageDeliveryMessage } from '../messages/MessageDeliveryMessage'

export class MessageDeliveryHandler implements MessageHandler {
  public supportedMessages = [MessageDeliveryMessage]
  private mediationRecipientService: MediationRecipientService

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: InboundMessageContext<MessageDeliveryMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryReceivedMessage = await this.mediationRecipientService.processDelivery(messageContext)

    if (deliveryReceivedMessage) {
      return new OutboundMessageContext(deliveryReceivedMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
