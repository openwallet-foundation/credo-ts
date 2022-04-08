import type { Handler } from '../../../agent/Handler'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { MediatorService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { StatusMessage } from '../messages/StatusMessage'

export class StatusHandler implements Handler {
  public supportedMessages = [StatusMessage]
  private mediatorService: MediatorService

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: InboundMessageContext<StatusMessage>) {
    const deliveryRequestMessage = this.mediatorService.processStatus(messageContext.message)
    const connection = messageContext.connection

    if (connection && deliveryRequestMessage) {
      return createOutboundMessage(connection, deliveryRequestMessage)
    }
  }
}
