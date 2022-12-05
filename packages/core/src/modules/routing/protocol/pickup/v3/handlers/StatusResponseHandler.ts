import type { Handler } from '../../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../../agent/models/InboundMessageContext'
import type { V3MessagePickupService } from '../V3MessagePickupService'

import { StatusResponseMessage } from '../messages'

export class StatusResponseHandler implements Handler {
  public supportedMessages = [StatusResponseMessage]
  private messagePickupService: V3MessagePickupService

  public constructor(messagePickupService: V3MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: InboundMessageContext<StatusResponseMessage>) {
    messageContext.assertReadyConnection()
    await this.messagePickupService.processStatusResponse(messageContext)
  }
}
