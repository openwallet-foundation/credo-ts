import type { MessageHandler } from '../../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { MediationRecipientService } from '../../../../services'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { StatusMessage } from '../messages'

export class StatusHandler implements MessageHandler {
  public supportedMessages = [StatusMessage]
  private mediatorRecipientService: MediationRecipientService

  public constructor(mediatorRecipientService: MediationRecipientService) {
    this.mediatorRecipientService = mediatorRecipientService
  }

  public async handle(messageContext: InboundMessageContext<StatusMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryRequestMessage = await this.mediatorRecipientService.processStatus(messageContext)

    if (deliveryRequestMessage) {
      return new OutboundMessageContext(deliveryRequestMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
