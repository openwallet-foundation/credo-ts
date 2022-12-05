import type { Handler } from '../../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { V2MessagePickupService } from '../V2MessagePickupService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { StatusMessage } from '../messages'

export class StatusHandler implements Handler {
  public supportedMessages = [StatusMessage]
  private messagePickupService: V2MessagePickupService

  public constructor(messagePickupService: V2MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<StatusMessage>) {
    const connection = messageContext.assertReadyConnection()
    const deliveryRequestMessage = await this.messagePickupService.processStatus(messageContext)

    if (deliveryRequestMessage) {
      return new OutboundMessageContext(deliveryRequestMessage, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
