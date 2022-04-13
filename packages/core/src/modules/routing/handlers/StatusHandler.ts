import type { Handler } from '../../../agent/Handler'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { MediationRecipientService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { StatusMessage } from '../messages/StatusMessage'

export class StatusHandler implements Handler {
  public supportedMessages = [StatusMessage]
  private mediatorRecipientService: MediationRecipientService

  public constructor(mediatorRecipientService: MediationRecipientService) {
    this.mediatorRecipientService = mediatorRecipientService
  }

  public async handle(messageContext: InboundMessageContext<StatusMessage>) {
    const deliveryRequestMessage = this.mediatorRecipientService.processStatus(messageContext.message)
    const connection = messageContext.connection

    if (connection && deliveryRequestMessage) {
      return createOutboundMessage(connection, deliveryRequestMessage)
    }
  }
}
